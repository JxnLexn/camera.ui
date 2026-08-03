import { boxIou } from '@camera.ui/rust-postprocessor';

import type { Logger } from '@camera.ui/common/logger';
import type { BoundingBox, Detection, TrackedDetection } from '@camera.ui/sdk';

// parked bike ~0.0006, standing person ~0.003-0.03
export const STATIONARY_SPEED_THRESHOLD = 0.002;
export const ANCHOR_SIGHTINGS = 6;
export const ANCHOR_SETTLE_MS = 8000;
export const ANCHOR_SETTLE_ANIMAL_MS = 120_000;
export const ANCHOR_SETTLE_PERSON_MS = 600_000;
export const ANCHOR_MIN_MEAN_SCORE = 0.65;
export const ANCHOR_MISSED_EVENTS = 5;
export const ANCHOR_UNSEEN_ACTIVE_MS = 60 * 60_000;
export const WAKE_IOU = 0.6;
export const DEPART_IOU = 0.15;
export const WAKE_SIGHTINGS = 3;

const MAX_ANCHORS = 25;
const MAX_CANDIDATES = 25;
const ANCHOR_DRIFT_ALPHA = 0.1;
const MAX_TICK_GAP_MS = 5000;

function settleMsFor(label: string): number {
  if (label === 'person') return ANCHOR_SETTLE_PERSON_MS;
  if (label === 'animal') return ANCHOR_SETTLE_ANIMAL_MS;
  return ANCHOR_SETTLE_MS;
}

function anchorExpires(label: string): boolean {
  return label === 'person' || label === 'animal';
}

interface StationaryAnchor {
  box: BoundingBox;
  label: string;
  sealed: boolean;
  ghost: boolean;
  dormant: boolean;
  wakeMisses: number;
  settleSightings: number;
  settleSinceMs: number;
  missedEvents: number;
  unseenActiveMs: number;
}

interface CandidateAnchor {
  box: BoundingBox;
  label: string;
  sightings: number;
  ghost: boolean;
  stillSinceMs: number;
  scoreSum: number;
}

export class StationarySuppressor {
  private readonly anchors = new Map<number, StationaryAnchor>();
  private readonly candidates: CandidateAnchor[] = [];
  private readonly labelsSeen = new Set<string>();
  private suppressionLogged = false;
  private lastEvaluateAt = 0;

  constructor(
    private readonly logger: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  public evaluate(detections: TrackedDetection[]): boolean {
    const now = this.now();
    const tickMs = this.lastEvaluateAt === 0 ? 0 : Math.min(now - this.lastEvaluateAt, MAX_TICK_GAP_MS);
    this.lastEvaluateAt = now;

    let hasActiveTrack = false;
    const tickLabels = new Set<string>();
    for (const t of detections) {
      if (t.trackLost) continue;
      tickLabels.add(t.label);
      this.labelsSeen.add(t.label);
      if (this.evaluateTrack(t, now)) hasActiveTrack = true;
    }
    this.ageUnseenAnchors(tickLabels, tickMs);
    return hasActiveTrack;
  }

  public isAnchored(trackId: number): boolean {
    return this.anchors.has(trackId);
  }

  public isSealed(trackId: number | undefined): boolean {
    if (trackId === undefined) return false;
    const anchor = this.anchors.get(trackId);
    return anchor ? anchor.sealed && !anchor.dormant : false;
  }

  public excludeSealed<T extends Detection>(detections: T[]): T[] {
    return detections.filter((d) => !this.isSealed((d as Partial<TrackedDetection>).trackId));
  }

  public logSuppressedOnce(detections: TrackedDetection[]): void {
    if (this.suppressionLogged) return;
    this.suppressionLogged = true;
    const parked = detections
      .filter((t) => !t.trackLost && t.trackId !== undefined)
      .map((t) => `${t.label}#${t.trackId}`)
      .join(', ');
    this.logger.trace(`Object detection suppressed — only known-stationary object(s) in view: ${parked}`);
  }

  public retainAcrossEvent(retainTracks: (trackIds: number[]) => number[]): void {
    const survivors = new Set(retainTracks([...this.anchors.keys()]));

    for (const [id, anchor] of [...this.anchors.entries()]) {
      anchor.sealed = true;

      if (survivors.has(id)) {
        anchor.ghost = false;
        anchor.missedEvents = 0;
      } else if (!this.labelsSeen.has(anchor.label)) {
        // a motion-only event says nothing about a parked object: the detector
        // never reported that label, so absence is not evidence it left. For
        // person/animal that immunity is bounded: detection demonstrably ran
        // (other labels were reported) and kept not seeing them
        if (this.labelsSeen.size > 0 && anchorExpires(anchor.label)) {
          anchor.missedEvents += 1;
          if (anchor.missedEvents >= ANCHOR_MISSED_EVENTS) {
            this.anchors.delete(id);
            this.logger.trace(`Static suppression: ${anchor.label}#${id} expired, unseen across ${anchor.missedEvents} detection-active events`);
          }
        }
        continue;
      } else if (anchor.ghost) {
        this.anchors.delete(id);
      } else {
        anchor.ghost = true;
      }
    }

    for (let i = this.candidates.length - 1; i >= 0; i--) {
      const candidate = this.candidates[i];
      if (!this.labelsSeen.has(candidate.label)) continue;

      if (candidate.ghost) {
        this.candidates.splice(i, 1);
      } else {
        candidate.ghost = true;
      }
    }

    this.labelsSeen.clear();

    while (this.anchors.size > MAX_ANCHORS) {
      const oldest = this.anchors.keys().next().value;
      if (oldest === undefined) break;
      this.anchors.delete(oldest);
    }

    if (this.anchors.size > 0) {
      const kept = [...this.anchors.entries()].map(([id, a]) => `${a.label}#${id}${a.ghost ? ' (ghost)' : ''}`).join(', ');
      this.logger.trace(`Static suppression: keeping ${this.anchors.size} anchor(s) across event end: ${kept}`);
    }
  }

  public clear(): void {
    this.anchors.clear();
    this.candidates.length = 0;
    this.labelsSeen.clear();
  }

  public dropForCameraMove(): void {
    if (this.anchors.size > 0) {
      this.logger.trace(`Static suppression: dropping ${this.anchors.size} anchor(s), camera moved`);
    }
    this.anchors.clear();
    this.candidates.length = 0;
    this.labelsSeen.clear();
  }

  public resetEventState(): void {
    this.suppressionLogged = false;
  }

  private evaluateTrack(t: TrackedDetection, now: number): boolean {
    // no trackId = external smart-camera write, nothing to judge stationarity by
    if (t.trackId === undefined) return true;

    const anchor = this.anchors.get(t.trackId);
    if (anchor) {
      anchor.ghost = false;
      anchor.missedEvents = 0;
      return anchor.dormant ? this.evaluateDormant(t, anchor, now) : this.evaluateAnchored(t, anchor);
    }

    const candidate = this.matchCandidate(t);

    if ((t.trackSpeed ?? 0) < STATIONARY_SPEED_THRESHOLD) {
      if (this.adoptAnchor(t)) {
        if (candidate) this.candidates.splice(this.candidates.indexOf(candidate), 1);
        return false;
      }

      if (candidate) {
        candidate.box = t.box;
        candidate.ghost = false;
        candidate.sightings += 1;
        candidate.scoreSum += t.confidence ?? 0;
        if (
          candidate.sightings >= ANCHOR_SIGHTINGS &&
          now - candidate.stillSinceMs >= settleMsFor(t.label) &&
          candidate.scoreSum / candidate.sightings >= ANCHOR_MIN_MEAN_SCORE
        ) {
          this.candidates.splice(this.candidates.indexOf(candidate), 1);
          this.anchors.set(t.trackId, {
            box: t.box,
            label: t.label,
            sealed: false,
            ghost: false,
            dormant: false,
            wakeMisses: 0,
            settleSightings: 0,
            settleSinceMs: 0,
            missedEvents: 0,
            unseenActiveMs: 0,
          });
        }
      } else if (this.candidates.length < MAX_CANDIDATES) {
        this.candidates.push({ box: t.box, label: t.label, sightings: 1, ghost: false, stillSinceMs: now, scoreSum: t.confidence ?? 0 });
      }
    } else if (candidate) {
      // erode instead of reset: a single noisy speed frame must not wipe the
      // warm-up of a genuinely parked object
      candidate.scoreSum -= candidate.scoreSum / candidate.sightings;
      candidate.sightings -= 1;
      // a person's stillness window restarts on real movement: the minutes-long
      // settle targets frozen detections, not people who paused mid-walk
      if (t.label === 'person') candidate.stillSinceMs = now;
      if (candidate.sightings <= 0) {
        this.candidates.splice(this.candidates.indexOf(candidate), 1);
      }
    }
    return true;
  }

  private ageUnseenAnchors(tickLabels: Set<string>, tickMs: number): void {
    if (tickMs <= 0 || this.anchors.size === 0) return;
    for (const [id, anchor] of this.anchors) {
      if (!anchorExpires(anchor.label)) continue;
      if (tickLabels.has(anchor.label)) {
        anchor.unseenActiveMs = 0;
        continue;
      }
      anchor.unseenActiveMs += tickMs;
      if (anchor.unseenActiveMs >= ANCHOR_UNSEEN_ACTIVE_MS) {
        this.anchors.delete(id);
        this.logger.trace(`Static suppression: ${anchor.label}#${id} expired, unseen for ${Math.round(anchor.unseenActiveMs / 60_000)}min of detection`);
      }
    }
  }

  private matchCandidate(t: TrackedDetection): CandidateAnchor | undefined {
    let best: CandidateAnchor | undefined;
    let bestIou = WAKE_IOU;
    for (const candidate of this.candidates) {
      if (candidate.label !== t.label) continue;
      const iou = boxIou(candidate.box, t.box);
      if (iou >= bestIou) {
        best = candidate;
        bestIou = iou;
      }
    }
    return best;
  }

  private evaluateAnchored(t: TrackedDetection, anchor: StationaryAnchor): boolean {
    const iou = boxIou(anchor.box, t.box);

    if (iou < DEPART_IOU) {
      anchor.wakeMisses += 1;
      if (anchor.wakeMisses >= WAKE_SIGHTINGS) {
        anchor.dormant = true;
        anchor.wakeMisses = 0;
        anchor.settleSightings = 0;
        this.logger.trace(`Static suppression: ${t.label}#${t.trackId} left its anchor — counting as active again`);
        return true;
      }
    } else if (iou >= WAKE_IOU) {
      anchor.wakeMisses = 0;
      if ((t.trackSpeed ?? 0) < STATIONARY_SPEED_THRESHOLD) {
        anchor.box = {
          x: anchor.box.x + (t.box.x - anchor.box.x) * ANCHOR_DRIFT_ALPHA,
          y: anchor.box.y + (t.box.y - anchor.box.y) * ANCHOR_DRIFT_ALPHA,
          width: anchor.box.width + (t.box.width - anchor.box.width) * ANCHOR_DRIFT_ALPHA,
          height: anchor.box.height + (t.box.height - anchor.box.height) * ANCHOR_DRIFT_ALPHA,
        };
      }
    }

    return false;
  }

  private evaluateDormant(t: TrackedDetection, anchor: StationaryAnchor, now: number): boolean {
    const stationary = (t.trackSpeed ?? 0) < STATIONARY_SPEED_THRESHOLD;

    if (stationary && boxIou(anchor.box, t.box) >= WAKE_IOU) {
      anchor.dormant = false;
      anchor.settleSightings = 0;
      this.logger.trace(`Static suppression: ${t.label}#${t.trackId} settled back onto its anchor`);
      return false;
    }

    if (stationary) {
      if (anchor.settleSightings === 0) anchor.settleSinceMs = now;
      anchor.settleSightings += 1;
      if (anchor.settleSightings >= ANCHOR_SIGHTINGS && now - anchor.settleSinceMs >= settleMsFor(t.label)) {
        anchor.box = t.box;
        anchor.dormant = false;
        anchor.settleSightings = 0;
        this.logger.trace(`Static suppression: ${t.label}#${t.trackId} re-anchored at a new spot`);
        return false;
      }
    } else {
      anchor.settleSightings = 0;
    }
    return true;
  }

  private adoptAnchor(t: TrackedDetection): boolean {
    if (t.trackId === undefined) return false;

    for (const [id, anchor] of this.anchors) {
      if (anchor.label !== t.label || boxIou(anchor.box, t.box) < WAKE_IOU) {
        continue;
      }

      this.anchors.delete(id);
      anchor.ghost = false;
      anchor.dormant = false;
      anchor.wakeMisses = 0;
      anchor.settleSightings = 0;
      anchor.missedEvents = 0;
      anchor.unseenActiveMs = 0;
      this.anchors.set(t.trackId, anchor);
      this.logger.trace(`Static suppression: ${anchor.label}#${id} re-identified as #${t.trackId} (anchor adopted)`);
      return true;
    }

    return false;
  }
}
