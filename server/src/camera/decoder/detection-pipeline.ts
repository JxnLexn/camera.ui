import {
  merge as rustMerge,
  nms as rustNms,
  nmsIndices as rustNmsIndices,
  ObjectTracker as RustObjectTracker,
  type Detection as RustDetection,
  type DetectionLine as RustDetectionLine,
  type DetectionZone as RustDetectionZone,
  type LineCrossingEvent as RustLineCrossingEvent,
  type TrackedDetection as RustTrackedDetection,
} from '@camera.ui/rust-postprocessor';

import type { BoundingBox, CameraDetectionSettings, Detection, DetectionLabel, DetectionLine, DetectionZone, TrackedDetection, VideoFrameData } from '@camera.ui/sdk';

const NMS_IOU_THRESHOLD = 0.45;
const NMS_CONFIDENCE_THRESHOLD = 0.25;
const OBJECT_MERGE_IOU_THRESHOLD = 0.3;
const OBJECT_MERGE_CLOSE_THRESHOLD = 0.0;
const MOTION_MERGE_IOU_THRESHOLD = 0.01;
const MOTION_MERGE_CLOSE_THRESHOLD = 0.1;
const TRACKER_IOU_THRESHOLD = 0.1;
const TRACKER_HIT_COUNTER_MAX = 30;
const TRACKER_INITIALIZATION_DELAY = 3;
const TRACK_CONFIRM_MS = 300;
const TRACK_KEEPALIVE_MS = 3000;
const CADENCE_SWITCH_AFTER_MS = 5000;
const MOTION_MATCH_ABOVE_MS = 400;

export const PAN_TO_IMAGE_RATIO = 4.0;

export interface LineCrossingEvent {
  lineName: string;
  direction: 'a-to-b' | 'b-to-a';
  trackId: number;
  label: DetectionLabel;
  confidence: number;
  timestamp: number;
  prevPos: [number, number];
  currPos: [number, number];
  prevBox: [number, number, number, number];
  box: [number, number, number, number];
}

export interface PipelineResult {
  tracked: TrackedDetection[];
  crossings: LineCrossingEvent[];
  created: number[];
  removed: number[];
}

function toRustDetection(det: Detection): RustDetection {
  return {
    x: det.box.x,
    y: det.box.y,
    width: det.box.width,
    height: det.box.height,
    confidence: det.confidence,
    label: det.label,
  };
}

function fromRustDetection(det: RustDetection): Detection {
  return {
    label: det.label as DetectionLabel,
    confidence: det.confidence,
    box: {
      x: det.x,
      y: det.y,
      width: det.width,
      height: det.height,
    },
  };
}

function fromRustTracked(det: RustTrackedDetection): TrackedDetection {
  return {
    label: det.label as DetectionLabel,
    confidence: det.confidence,
    box: {
      x: det.x,
      y: det.y,
      width: det.width,
      height: det.height,
    },
    trackId: det.trackId,
    trackAge: det.trackAge,
    trackLost: det.trackLost,
    trackSpeed: det.trackSpeed,
    trackVelocity: { x: det.trackVelocityX, y: det.trackVelocityY },
  };
}

function toRustZones(zones: DetectionZone[]): RustDetectionZone[] {
  return zones.map((zone) => ({
    labels: zone.labels,
    filter: zone.filter as RustDetectionZone['filter'],
    matchType: zone.type as RustDetectionZone['matchType'],
    isPrivacyMask: zone.isPrivacyMask,
    points: zone.points.map(([x, y]) => [x, y]),
  }));
}

function toRustLines(lines: DetectionLine[]): RustDetectionLine[] {
  return lines.map((line) => ({
    name: line.name,
    direction: line.direction as RustDetectionLine['direction'],
    labels: line.labels,
    points: [
      [line.points[0][0], line.points[0][1]],
      [line.points[1][0], line.points[1][1]],
    ],
  }));
}

function fromRustCrossing(event: RustLineCrossingEvent, lookup: Map<number, BoundingBox>): LineCrossingEvent {
  const box = lookup.get(event.trackId);
  const w = box?.width ?? 0;
  const h = box?.height ?? 0;
  return {
    lineName: event.lineName,
    direction: event.direction as 'a-to-b' | 'b-to-a',
    trackId: event.trackId,
    label: event.label as DetectionLabel,
    confidence: event.confidence,
    timestamp: event.timestampMs,
    prevPos: [event.prevX, event.prevY],
    currPos: [event.currX, event.currY],
    prevBox: [event.prevX - w / 2, event.prevY - h / 2, w, h],
    box: box ? [box.x, box.y, box.width, box.height] : [0, 0, 0, 0],
  };
}

export interface TrackerCadence {
  initializationDelay: number;
  hitCounterMax: number;
  motionTolerance?: number;
}

export class DetectionPipeline {
  private aspectRatio: number;
  private tracker: RustObjectTracker;

  private zones: DetectionZone[];
  private lines: DetectionLine[] = [];
  private minConfidence: number;
  private reidHitCounterMax = 0;

  private cadence: TrackerCadence = { initializationDelay: TRACKER_INITIALIZATION_DELAY, hitCounterMax: TRACKER_HIT_COUNTER_MAX };
  private pendingCadenceSince = 0;

  constructor(zones: DetectionZone[], settings: CameraDetectionSettings) {
    this.aspectRatio = 16 / 9;
    this.zones = zones;
    this.minConfidence = settings.object.confidence;
    this.tracker = this.createTracker();
  }

  public updateZones(zones: DetectionZone[]): void {
    this.zones = zones;
    this.tracker.setZones(toRustZones(zones));
  }

  public updateLines(lines: DetectionLine[], aspectRatio?: number): void {
    if (aspectRatio !== undefined) this.aspectRatio = aspectRatio;
    this.lines = lines;
    this.tracker.setLines(toRustLines(lines), this.aspectRatio);
  }

  public updateSettings(settings: CameraDetectionSettings): void {
    this.minConfidence = settings.object.confidence;
    this.tracker.setMinConfidence(settings.object.confidence);
  }

  public setReidHitCounterMax(frames: number): void {
    this.reidHitCounterMax = frames;
    this.tracker.setReidHitCounterMax(frames);
  }

  public syncDetectionCadence(intervalMs: number): TrackerCadence | undefined {
    if (intervalMs <= 0) return undefined;

    const target: TrackerCadence = {
      initializationDelay: Math.min(TRACKER_INITIALIZATION_DELAY, Math.max(1, Math.round(TRACK_CONFIRM_MS / intervalMs))),
      hitCounterMax: Math.min(TRACKER_HIT_COUNTER_MAX, Math.max(2, Math.round(TRACK_KEEPALIVE_MS / intervalMs))),
    };

    // below ~2.5/s a walking object out-runs its own box between detections,
    // IoU hits 0 and only distance matching can follow; tolerance scales with
    // the gap, capped so distant objects still can't steal each other's ids
    if (intervalMs >= MOTION_MATCH_ABOVE_MS) {
      target.motionTolerance = Math.min(0.4, 0.05 + (0.25 * intervalMs) / 1000);
    }

    if (
      target.initializationDelay === this.cadence.initializationDelay &&
      target.hitCounterMax === this.cadence.hitCounterMax &&
      target.motionTolerance === this.cadence.motionTolerance
    ) {
      this.pendingCadenceSince = 0;
      return undefined;
    }

    if (this.tracker.trackCount > 0) {
      const now = Date.now();
      if (this.pendingCadenceSince === 0) {
        this.pendingCadenceSince = now;
        return undefined;
      }
      if (now - this.pendingCadenceSince < CADENCE_SWITCH_AFTER_MS) return undefined;
    }

    this.cadence = target;
    this.pendingCadenceSince = 0;
    this.tracker = this.createTracker();

    return target;
  }

  private createTracker(): RustObjectTracker {
    const tracker = new RustObjectTracker({
      iouThreshold: TRACKER_IOU_THRESHOLD,
      hitCounterMax: this.cadence.hitCounterMax,
      initializationDelay: this.cadence.initializationDelay,
      motionTolerance: this.cadence.motionTolerance,
    });

    tracker.setMinConfidence(this.minConfidence);
    tracker.setZones(toRustZones(this.zones));
    if (this.lines.length > 0) tracker.setLines(toRustLines(this.lines), this.aspectRatio);
    if (this.reidHitCounterMax > 0) tracker.setReidHitCounterMax(this.reidHitCounterMax);

    return tracker;
  }

  public refreshReid(): void {
    this.tracker.refreshReid();
  }

  public process(rawDetections: Detection[], frame: VideoFrameData, poseDelta?: { panDelta: number; tiltDelta: number }): PipelineResult {
    const flat = rawDetections.length === 0 ? [] : this.runNmsAndMergeFlat(rawDetections);
    const cameraMotion = poseDelta ? { x: -poseDelta.panDelta * PAN_TO_IMAGE_RATIO, y: poseDelta.tiltDelta * PAN_TO_IMAGE_RATIO } : undefined;
    const result = this.tracker.update(flat, Date.now(), frame.data as Buffer, frame.width, frame.height, cameraMotion);
    const tracked = result.tracked.map(fromRustTracked);
    const boxLookup = new Map<number, BoundingBox>();
    for (const t of tracked) {
      if (t.trackId !== undefined) boxLookup.set(t.trackId, t.box);
    }

    return {
      tracked,
      crossings: result.crossings.map((c) => fromRustCrossing(c, boxLookup)),
      created: result.created,
      removed: result.removed,
    };
  }

  public runNms<T extends Detection>(rawDetections: T[]): T[] {
    if (rawDetections.length === 0) return [];
    const flat = rawDetections.map(toRustDetection).filter((d) => d.confidence >= NMS_CONFIDENCE_THRESHOLD);
    if (flat.length === 0) return [];
    const filteredMap: number[] = [];
    for (let i = 0; i < rawDetections.length; i++) {
      if (toRustDetection(rawDetections[i]).confidence >= NMS_CONFIDENCE_THRESHOLD) {
        filteredMap.push(i);
      }
    }
    const keptFilteredIndices = rustNmsIndices(flat, NMS_IOU_THRESHOLD);
    return keptFilteredIndices.map((fi) => rawDetections[filteredMap[fi]]);
  }

  public processExternal(detections: Detection[]): TrackedDetection[] {
    const zoneFiltered = this.runMergeAndZoneFilter(detections);
    return zoneFiltered.map((d) => ({ ...d, trackLost: false }));
  }

  public runMergeAndZoneFilter(detections: Detection[]): Detection[] {
    if (detections.length === 0) return [];
    const flat = detections.map(toRustDetection);
    const merged = rustMerge(flat, MOTION_MERGE_IOU_THRESHOLD, MOTION_MERGE_CLOSE_THRESHOLD);
    if (merged.length === 0) return [];
    const indices = this.tracker.filterIndices(merged);
    return indices.map((i) => fromRustDetection(merged[i]));
  }

  public runZoneFilter(detections: Detection[]): Detection[] {
    if (detections.length === 0) return [];
    const flat = detections.map(toRustDetection);
    const indices = this.tracker.filterIndices(flat);
    return indices.map((i) => detections[i]);
  }

  public runZoneFilterWithLabel<T extends { box: BoundingBox; confidence: number }>(items: T[], label: DetectionLabel): T[] {
    if (items.length === 0) return [];
    const flat: RustDetection[] = items.map((item) => ({
      x: item.box.x,
      y: item.box.y,
      width: item.box.width,
      height: item.box.height,
      confidence: item.confidence,
      label,
    }));
    const indices = this.tracker.filterIndices(flat);
    return indices.map((i) => items[i]);
  }

  public cleanup(): void {
    this.tracker.reset();
  }

  public retainTracks(trackIds: number[]): number[] {
    return this.tracker.retainTracks(trackIds);
  }

  private runNmsAndMergeFlat(rawDetections: Detection[]): RustDetection[] {
    const flat = rawDetections.map(toRustDetection).filter((d) => d.confidence >= NMS_CONFIDENCE_THRESHOLD);
    if (flat.length === 0) return [];
    const deduped = rustNms(flat, NMS_IOU_THRESHOLD);
    if (deduped.length === 0) return [];
    return rustMerge(deduped, OBJECT_MERGE_IOU_THRESHOLD, OBJECT_MERGE_CLOSE_THRESHOLD);
  }
}
