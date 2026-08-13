import { Decoder, Demuxer } from 'node-av/api';

import { FrameScaler } from '../frame-scaler.js';
import { createHardwareContext } from '../hardware.js';
import { ReconnectBackoff } from '../reconnect-backoff.js';

import type { Logger } from '@camera.ui/common/logger';
import type { FrameWorkerDecoderSettings } from '@camera.ui/sdk';
import type { HardwareContext } from 'node-av/api';
import type { Frame, Packet, Stream } from 'node-av/lib';
import type { PrivacyMask } from '../../privacy/mask.js';
import type { AnalysisSource, FrameSnap } from './analysis-source.js';

export interface BufferedSourceConfig {
  url: string;
  decoder?: FrameWorkerDecoderSettings;
  privacy?: PrivacyMask;
}

interface BufferedPacket {
  serial: number;
  packet: Packet;
}

export class BufferedSource implements AnalysisSource {
  private static readonly MAX_BUFFER_PACKETS = 600;
  private static readonly DECODER_IDLE_MS = 60_000;

  private input?: Demuxer;
  private videoStream?: Stream;
  private hwContext?: HardwareContext | null;
  private frameScaler?: FrameScaler;
  private packetWaiters: (() => void)[] = [];

  private buffer: BufferedPacket[] = [];
  private nextSerial = 0;
  private waitingForKeyframe = true;

  private decoder?: Decoder;
  private decodedThrough = -1;

  private cachedFrame?: Frame;
  private cachedFrameAt = 0;
  private lastPacketAt = 0;
  private lastDecodeAt = 0;

  private shouldRun = false;
  private connected = false;
  private producerPromise?: Promise<void>;
  private inflightDecode?: Promise<Frame | null>;

  private readonly backoff = new ReconnectBackoff();
  private sleepTimer?: NodeJS.Timeout;
  private sleepResolve?: () => void;

  constructor(
    private readonly config: BufferedSourceConfig,
    private readonly logger: Logger,
  ) {}

  public get isRunning(): boolean {
    return this.shouldRun;
  }

  public get hasBuffer(): boolean {
    return this.connected && this.buffer.length > 0;
  }

  public get scaler(): FrameScaler | undefined {
    return this.frameScaler;
  }

  public get lastFrameAt(): number {
    return this.cachedFrameAt;
  }

  public get hardwareContext(): HardwareContext | null | undefined {
    return this.hwContext;
  }

  public start(): void {
    if (this.shouldRun) return;
    this.shouldRun = true;
    this.backoff.reset();
    this.producerPromise = this.runProducer();
  }

  public async stop(): Promise<void> {
    if (!this.shouldRun && !this.producerPromise) return;
    this.shouldRun = false;
    this.wakeSleep();
    this.wakePacketWaiters();

    if (this.inflightDecode) {
      await this.inflightDecode;
    }

    if (this.producerPromise) {
      try {
        await this.producerPromise;
      } catch (error) {
        this.logger.debug('Buffered source producer exited with error:', error);
      }
      this.producerPromise = undefined;
    }

    this.frameScaler?.dispose();
    this.frameScaler = undefined;

    if (this.hwContext) {
      this.hwContext[Symbol.dispose]();
      this.hwContext = undefined;
    }
  }

  public async getFrame(maxAgeMs: number): Promise<Frame | null> {
    if (!this.hasBuffer || !this.videoStream) return null;

    if (this.cachedFrame && Date.now() - this.cachedFrameAt <= maxAgeMs) {
      return this.cachedFrame.clone();
    }

    this.inflightDecode ??= this.catchUpDecode()
      .catch((error) => {
        this.logger.debug('Buffered source decode failed:', error);
        return null;
      })
      .finally(() => {
        this.inflightDecode = undefined;
      });

    const frame = await this.inflightDecode;
    return frame?.clone() ?? null;
  }

  public async nextFrame(lastId: number): Promise<FrameSnap | undefined> {
    while (this.shouldRun) {
      if (this.hasBuffer && this.nextSerial - 1 > lastId) {
        const frame = await this.getFrame(0);
        // decoder delay can leave the cursor behind the newest packet, waiting
        // for the next one beats handing back a frame the caller already had
        if (frame && this.decodedThrough > lastId) {
          return { frame, id: this.decodedThrough };
        }
        frame?.[Symbol.dispose]?.();
      }
      await this.waitForPacket();
    }

    return undefined;
  }

  public async snapshotJpeg(maxWidth: number, quality?: number, maxAgeMs = 500): Promise<Buffer | null> {
    const frame = await this.getFrame(maxAgeMs);
    if (!frame) return null;

    try {
      return (await this.frameScaler?.frameToJPEG(frame, maxWidth, quality)) ?? null;
    } finally {
      frame[Symbol.dispose]?.();
    }
  }

  private async runProducer(): Promise<void> {
    while (this.shouldRun) {
      try {
        await this.connect();
        this.backoff.reset();

        for await (const packet of this.input!.packets(this.videoStream!.index)) {
          if (!this.shouldRun) {
            packet?.free();
            break;
          }
          if (!packet) continue;
          this.ingest(packet);
        }
      } catch (error: any) {
        if (this.shouldRun) {
          this.logger.debug(`Buffered source error: ${error.message}`);
        }
      }

      await this.teardown();
      if (!this.shouldRun) break;

      const delay = this.backoff.nextDelayMs();
      this.logger.debug(`Buffered source disconnected, reconnecting in ${delay / 1000}s...`);
      await this.sleep(delay);
    }

    await this.teardown();
  }

  private async connect(): Promise<void> {
    this.logger.debug('Connecting to buffered source:', this.config.url);

    this.input = await Demuxer.open(this.config.url, {
      options: {
        timeout: 15_000_000,
        rtsp_transport: 'tcp',
        user_agent: 'camera.ui FrameWorker',
        avioflags: 'direct',
      },
    });

    const videoStream = this.input.video();
    if (!videoStream) {
      throw new Error('No video stream found in buffered source');
    }
    this.videoStream = videoStream;

    this.hwContext ??= createHardwareContext(this.config.decoder, this.logger);
    this.frameScaler ??= new FrameScaler(this.hwContext, this.logger, this.config.privacy);

    this.waitingForKeyframe = true;
    this.connected = true;
    this.logger.debug(`Buffered source connected: ${videoStream.codecpar.width}x${videoStream.codecpar.height}`);
  }

  private ingest(packet: Packet): void {
    this.lastPacketAt = Date.now();
    if (packet.isKeyframe) {
      this.clearBuffer();
      this.waitingForKeyframe = false;
      this.buffer.push({ serial: this.nextSerial++, packet });
      this.wakePacketWaiters();
      return;
    }

    if (this.waitingForKeyframe || this.buffer.length >= BufferedSource.MAX_BUFFER_PACKETS) {
      if (this.buffer.length >= BufferedSource.MAX_BUFFER_PACKETS) {
        this.clearBuffer();
        this.waitingForKeyframe = true;
      }
      packet.free();
      return;
    }

    this.buffer.push({ serial: this.nextSerial++, packet });
    this.wakePacketWaiters();
    this.releaseIdleDecoder();
  }

  private releaseIdleDecoder(): void {
    if (!this.decoder || this.inflightDecode) return;
    if (Date.now() - this.lastDecodeAt < BufferedSource.DECODER_IDLE_MS) return;

    // the cached frame stays: it is one frame against the decoder's whole pool,
    // and it keeps the first tick after waking on the main stream instead of
    // falling back to the substream while the decoder is still warming up
    this.logger.debug('Releasing idle decoder, packet buffer and last frame stay');
    this.disposeDecoder();
    this.frameScaler?.clearCache();
  }

  private waitForPacket(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.packetWaiters.push(resolve);
    });
  }

  private wakePacketWaiters(): void {
    if (this.packetWaiters.length === 0) return;
    const waiters = this.packetWaiters;
    this.packetWaiters = [];
    for (const resolve of waiters) resolve();
  }

  private async catchUpDecode(): Promise<Frame | null> {
    const pending: BufferedPacket[] = [];
    for (const b of this.buffer) {
      if (b.serial <= this.decodedThrough) continue;
      const cloned = b.packet.clone();
      if (cloned) pending.push({ serial: b.serial, packet: cloned });
    }

    if (pending.length === 0 || !this.videoStream) {
      // nothing new since the last feed, the cached frame is the newest
      return this.cachedFrame ?? null;
    }

    let last: Frame | undefined;
    try {
      this.decoder ??= await Decoder.create(this.videoStream, {
        hardware: this.hwContext ?? undefined,
        exitOnError: false,
      });

      for (const p of pending) {
        await this.decoder.decode(p.packet);
        let frame;
        while ((frame = await this.decoder.receive())) {
          last?.[Symbol.dispose]?.();
          last = frame;
        }
        this.decodedThrough = p.serial;
      }

      if (!last) {
        // decoder delay swallowed the fed packets, the cache stays newest
        return this.cachedFrame ?? null;
      }

      // ownership moves into the cache, consumers receive clones via getFrame
      this.cachedFrame?.[Symbol.dispose]?.();
      this.cachedFrame = last;
      this.cachedFrameAt = this.lastPacketAt || Date.now();
      this.lastDecodeAt = Date.now();
      const result = last;
      last = undefined;
      return result;
    } catch (error) {
      // drop the warm decoder and reset the cursor, the next call re-feeds
      // from the buffered keyframe
      this.logger.debug('Buffered source warm decoder reset:', error);
      this.disposeDecoder();
      return this.cachedFrame ?? null;
    } finally {
      last?.[Symbol.dispose]?.();
      for (const p of pending) p.packet.free();
    }
  }

  private disposeDecoder(): void {
    try {
      this.decoder?.[Symbol.dispose]();
    } catch {
      // ignore
    }
    this.decoder = undefined;
    this.decodedThrough = -1;
  }

  private async teardown(): Promise<void> {
    this.connected = false;
    this.clearBuffer();
    this.waitingForKeyframe = true;
    this.disposeDecoder();
    this.videoStream = undefined;

    this.cachedFrame?.[Symbol.dispose]?.();
    this.cachedFrame = undefined;
    this.cachedFrameAt = 0;
    this.lastPacketAt = 0;

    if (this.input) {
      try {
        await this.input[Symbol.asyncDispose]();
      } catch {
        // ignore
      }
      this.input = undefined;
    }
  }

  private clearBuffer(): void {
    for (const b of this.buffer) {
      try {
        b.packet.free();
      } catch {
        // ignore
      }
    }
    this.buffer = [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.sleepResolve = resolve;
      this.sleepTimer = setTimeout(() => {
        this.sleepResolve = undefined;
        resolve();
      }, ms);
    });
  }

  private wakeSleep(): void {
    clearTimeout(this.sleepTimer);
    this.sleepTimer = undefined;
    this.sleepResolve?.();
    this.sleepResolve = undefined;
  }
}
