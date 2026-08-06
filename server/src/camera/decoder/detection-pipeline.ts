import { CameraWorld, merge as rustMerge, nms as rustNms, nmsIndices as rustNmsIndices } from '@camera.ui/rust-postprocessor';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type {
  Detection as RustDetection,
  DetectionLine as RustDetectionLine,
  DetectionZone as RustDetectionZone,
  LineCrossingEvent as RustLineCrossingEvent,
  WorldEvent,
  WorldObject,
} from '@camera.ui/rust-postprocessor';
import type { BoundingBox, CameraDetectionSettings, Detection, DetectionLabel, DetectionLine, DetectionZone, TrackedDetection } from '@camera.ui/sdk';

const NMS_IOU_THRESHOLD = 0.45;
const NMS_CONFIDENCE_THRESHOLD = 0.25;
const OBJECT_MERGE_IOU_THRESHOLD = 0.3;
const OBJECT_MERGE_CLOSE_THRESHOLD = 0.0;
const MOTION_MERGE_IOU_THRESHOLD = 0.01;
const MOTION_MERGE_CLOSE_THRESHOLD = 0.1;
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
  events: WorldEvent[];
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

function fromWorldObject(obj: WorldObject): TrackedDetection {
  return {
    label: obj.label as DetectionLabel,
    confidence: obj.confidence,
    box: {
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
    },
    trackId: obj.trackId,
    trackAge: 0,
    trackLost: false,
    trackSpeed: obj.speed,
    trackVelocity: { x: obj.velocityX, y: obj.velocityY },
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

function createTickRecorder(): ((line: string) => void) | undefined {
  const home = process.env.CAMERA_UI_HOME_PATH;
  const toggleDir = home ? join(home, 'detection-record') : undefined;
  const dir = process.env.CAMERA_UI_DETECTION_RECORD_DIR ?? (toggleDir && existsSync(toggleDir) ? toggleDir : undefined);
  if (!dir) return undefined;
  mkdirSync(dir, { recursive: true });
  const stream = createWriteStream(join(dir, `${process.env.CAMERA_ID ?? 'camera'}-${Date.now()}.jsonl`), { flags: 'a' });
  return (line) => stream.write(`${line}\n`);
}

const recordTick = createTickRecorder();

function recordConfig(config: Record<string, unknown>): void {
  recordTick?.(JSON.stringify({ config }));
}

export class DetectionPipeline {
  private aspectRatio = 16 / 9;
  private world: CameraWorld;
  private lines: DetectionLine[] = [];
  private suppressStatic: boolean;

  constructor(zones: DetectionZone[], settings: CameraDetectionSettings) {
    this.world = new CameraWorld();
    const rustZones = toRustZones(zones);
    this.world.setZones(rustZones);
    this.world.setMinConfidence(settings.object.confidence);
    this.suppressStatic = settings.object.suppressStatic ?? true;
    recordConfig({ zones: rustZones, minConfidence: settings.object.confidence });
  }

  public updateZones(zones: DetectionZone[]): void {
    const rustZones = toRustZones(zones);
    this.world.setZones(rustZones);
    recordConfig({ zones: rustZones });
  }

  public updateLines(lines: DetectionLine[], aspectRatio?: number): void {
    if (aspectRatio !== undefined) this.aspectRatio = aspectRatio;
    this.lines = lines;
    const rustLines = toRustLines(lines);
    this.world.setLines(rustLines, this.aspectRatio);
    recordConfig({ lines: rustLines, aspectRatio: this.aspectRatio });
  }

  public updateSettings(settings: CameraDetectionSettings): void {
    this.world.setMinConfidence(settings.object.confidence);
    this.suppressStatic = settings.object.suppressStatic ?? true;
    recordConfig({ minConfidence: settings.object.confidence });
  }

  public notifyCameraMove(): void {
    this.world.notifyCameraMove();
  }

  public process(rawDetections: Detection[], poseDelta?: { panDelta: number; tiltDelta: number }): PipelineResult {
    const flat = rawDetections.length === 0 ? [] : this.runNmsAndMergeFlat(rawDetections);
    const cameraMotion = poseDelta ? { x: -poseDelta.panDelta * PAN_TO_IMAGE_RATIO, y: poseDelta.tiltDelta * PAN_TO_IMAGE_RATIO } : undefined;
    const tMs = Date.now();
    recordTick?.(JSON.stringify({ tMs, detections: flat, cameraMotion }));
    const result = this.world.ingest(tMs, flat, cameraMotion);
    const tracked = (this.suppressStatic ? result.tracked.filter((t) => t.state !== 'stationary') : result.tracked).map(fromWorldObject);
    const boxLookup = new Map<number, BoundingBox>();
    for (const t of tracked) {
      if (t.trackId !== undefined) boxLookup.set(t.trackId, t.box);
    }

    return {
      tracked,
      crossings: result.crossings.map((c) => fromRustCrossing(c, boxLookup)),
      created: result.created,
      removed: result.removed,
      events: result.events,
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
    const indices = this.world.filterIndices(merged);
    return indices.map((i) => fromRustDetection(merged[i]));
  }

  public runZoneFilter(detections: Detection[]): Detection[] {
    if (detections.length === 0) return [];
    const flat = detections.map(toRustDetection);
    const indices = this.world.filterIndices(flat);
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
    const indices = this.world.filterIndices(flat);
    return indices.map((i) => items[i]);
  }

  public retainTracks(trackIds: number[]): number[] {
    return trackIds;
  }

  private runNmsAndMergeFlat(rawDetections: Detection[]): RustDetection[] {
    const flat = rawDetections.map(toRustDetection).filter((d) => d.confidence >= NMS_CONFIDENCE_THRESHOLD);
    if (flat.length === 0) return [];
    const deduped = rustNms(flat, NMS_IOU_THRESHOLD);
    if (deduped.length === 0) return [];
    return rustMerge(deduped, OBJECT_MERGE_IOU_THRESHOLD, OBJECT_MERGE_CLOSE_THRESHOLD);
  }
}
