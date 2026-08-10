import { detectionRecord } from './detection-record.js';

import type { Logger } from '@camera.ui/common/logger';

const REPORT_MS = 60_000;

export class PerfTracker {
  public since = 0;
  public loopMs = 0;
  public idleTicks = 0;
  public activeTicks = 0;
  public mainFrames = 0;
  public switches = 0;
  public decodeMs = 0;
  public scaleMs = 0;
  public jpegMs = 0;
  public inferMs = 0;
  public secondaryMs = 0;
  public objects = 0;
  public faces = 0;
  public plates = 0;

  private readonly enabled = Boolean(process.env.CAMERA_UI_DEBUG_DIR);
  private cpu = process.cpuUsage();

  public report(logger: Logger): void {
    if (!this.enabled) return;

    const now = Date.now();
    if (this.since === 0) {
      this.since = now;
      return;
    }

    const elapsed = now - this.since;
    if (elapsed < REPORT_MS) return;

    const ticks = this.idleTicks + this.activeTicks;
    if (ticks > 0) {
      const cpu = process.cpuUsage(this.cpu);
      const cpuMs = Math.round((cpu.user + cpu.system) / 1000);
      const mem = process.memoryUsage();
      const rssMb = Math.round(mem.rss / 1024 / 1024);
      const externalMb = Math.round(mem.external / 1024 / 1024);
      const { loopMs, idleTicks, activeTicks, mainFrames, switches, decodeMs, scaleMs, jpegMs, inferMs, secondaryMs, objects, faces, plates } = this;
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
    this.loopMs = 0;
    this.idleTicks = 0;
    this.activeTicks = 0;
    this.mainFrames = 0;
    this.switches = 0;
    this.decodeMs = 0;
    this.scaleMs = 0;
    this.jpegMs = 0;
    this.inferMs = 0;
    this.secondaryMs = 0;
    this.objects = 0;
    this.faces = 0;
    this.plates = 0;
  }
}
