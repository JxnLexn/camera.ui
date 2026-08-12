import { detectionRecord } from './debug/detection-record.js';

import type { Logger } from '@camera.ui/common/logger';
import type { FrameWorkerPerfSnapshot } from './types.js';

const REPORT_MS = 60_000;

interface PerfCounters {
  loopMs: number;
  idleTicks: number;
  activeTicks: number;
  mainFrames: number;
  switches: number;
  decodeMs: number;
  scaleMs: number;
  jpegMs: number;
  inferMs: number;
  inferCount: number;
  secondaryMs: number;
  objects: number;
  faces: number;
  plates: number;
}

export class PerfTracker {
  public loopMs = 0;
  public idleTicks = 0;
  public activeTicks = 0;
  public mainFrames = 0;
  public switches = 0;
  public decodeMs = 0;
  public scaleMs = 0;
  public jpegMs = 0;
  public inferMs = 0;
  public inferCount = 0;
  public secondaryMs = 0;
  public objects = 0;
  public faces = 0;
  public plates = 0;

  private readonly enabled = Boolean(process.env.CAMERA_UI_DEBUG_DIR);
  private cpu = process.cpuUsage();
  private since = 0;
  private reportBase = this.copyCounters();
  private snapshotBase = this.copyCounters();
  private snapshotAt = Date.now();

  public snapshot(): Omit<FrameWorkerPerfSnapshot, 'mainStreamEnabled' | 'frameAnalysis'> {
    const now = Date.now();
    const delta = this.diff(this.snapshotBase);
    const elapsedMs = now - this.snapshotAt;

    this.snapshotBase = this.copyCounters();
    this.snapshotAt = now;

    return { elapsedMs, ticks: delta.idleTicks + delta.activeTicks, ...delta };
  }

  public report(logger: Logger): void {
    if (!this.enabled) return;

    const now = Date.now();
    if (this.since === 0) {
      this.since = now;
      return;
    }

    const elapsed = now - this.since;
    if (elapsed < REPORT_MS) return;

    const { loopMs, idleTicks, activeTicks, mainFrames, switches, decodeMs, scaleMs, jpegMs, inferMs, secondaryMs, objects, faces, plates } = this.diff(this.reportBase);
    const ticks = idleTicks + activeTicks;
    if (ticks > 0) {
      const cpu = process.cpuUsage(this.cpu);
      const cpuMs = Math.round((cpu.user + cpu.system) / 1000);
      const mem = process.memoryUsage();
      const rssMb = Math.round(mem.rss / 1024 / 1024);
      const externalMb = Math.round(mem.external / 1024 / 1024);
      const rate = loopMs > 0 ? (ticks / (loopMs / 1000)).toFixed(1) : '0';
      const activePct = Math.round((activeTicks / ticks) * 100);
      const shape = `${Math.round(elapsed / 1000)}s loop=${Math.round(loopMs / 1000)}s ticks=${ticks} (${rate}/s) active=${activePct}% switches=${switches}`;
      const cost = `cpu=${cpuMs}ms decode=${decodeMs}ms scale=${scaleMs}ms jpeg=${jpegMs}ms infer=${inferMs}ms secondary=${secondaryMs}ms`;
      const found = `rss=${rssMb}MB ext=${externalMb}MB obj=${objects} face=${faces} plate=${plates}`;
      logger.debug(`[perf] ${shape} ${cost} ${found}`);
      detectionRecord.perf({
        elapsedMs: elapsed,
        loopMs,
        idleTicks,
        activeTicks,
        mainFrames,
        switches,
        cpuMs,
        rssMb,
        externalMb,
        decodeMs,
        scaleMs,
        jpegMs,
        inferMs,
        secondaryMs,
        objects,
        faces,
        plates,
      });
    }

    this.cpu = process.cpuUsage();
    this.since = now;
    this.reportBase = this.copyCounters();
  }

  private copyCounters(): PerfCounters {
    return {
      loopMs: this.loopMs,
      idleTicks: this.idleTicks,
      activeTicks: this.activeTicks,
      mainFrames: this.mainFrames,
      switches: this.switches,
      decodeMs: this.decodeMs,
      scaleMs: this.scaleMs,
      jpegMs: this.jpegMs,
      inferMs: this.inferMs,
      inferCount: this.inferCount,
      secondaryMs: this.secondaryMs,
      objects: this.objects,
      faces: this.faces,
      plates: this.plates,
    };
  }

  private diff(base: PerfCounters): PerfCounters {
    const current = this.copyCounters();
    const out = {} as PerfCounters;
    for (const key of Object.keys(current) as (keyof PerfCounters)[]) {
      out[key] = current[key] - base[key];
    }
    return out;
  }
}
