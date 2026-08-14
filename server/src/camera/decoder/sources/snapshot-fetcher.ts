import { FrameHandle } from './frame-handle.js';

import type { Logger } from '@camera.ui/common/logger';

export interface SnapshotConfig {
  snapshotUrl: string;
  snapshotTimeoutMs?: number;
  snapshotProvider?: () => Promise<Buffer | null>;
}

const DEFAULT_TIMEOUT_MS = 8000;
const COALESCING_WINDOW_MS = 200;

export class SnapshotFetcher {
  private inflight?: Promise<FrameHandle | null>;

  constructor(
    private readonly config: SnapshotConfig,
    private readonly logger: Logger,
  ) {}

  public async fetch(): Promise<FrameHandle | null> {
    if (!this.inflight) {
      const timeoutMs = this.config.snapshotTimeoutMs ?? DEFAULT_TIMEOUT_MS;
      const thisFetch = this.open(timeoutMs).catch((e) => {
        this.logger.debug('snapshot fetch failed:', e);
        return null;
      });
      this.inflight = thisFetch;

      // per-fetch dispose timer, overlapping fetches must not share state
      thisFetch.finally(() => {
        setTimeout(async () => {
          if (this.inflight === thisFetch) {
            this.inflight = undefined;
          }
          try {
            const root = await thisFetch;
            if (root) await root[Symbol.asyncDispose]();
          } catch {
            // ignore
          }
        }, COALESCING_WINDOW_MS);
      });
    }

    const rootHandle = await this.inflight;
    if (!rootHandle) return null;
    const cloned = rootHandle.frame.clone();
    return cloned ? FrameHandle.fromClonedFrame(cloned) : null;
  }

  private async open(timeoutMs: number): Promise<FrameHandle | null> {
    if (this.config.snapshotProvider) {
      try {
        const jpeg = await this.config.snapshotProvider();
        if (jpeg && jpeg.length > 0) {
          return await FrameHandle.fromBuffer(jpeg);
        }
      } catch {
        // fall back to snapshotUrl
      }
    }
    return FrameHandle.fromUrl(this.config.snapshotUrl, timeoutMs);
  }
}
