import type { BoundingBox, MotionResolution, StreamingRole } from '@camera.ui/sdk';

export type PixelFormat = 'yuv420p' | 'rgb24' | 'nv12';

export type AnalysisStream = 'low' | 'main';

export const FULL_FRAME_BOX: BoundingBox = { x: 0, y: 0, width: 1, height: 1 };

export function ensureDetectionBoxes<T extends { box?: BoundingBox }>(detections: readonly T[]): (T & { box: BoundingBox })[] {
  return detections.map((detection) => (detection.box ? (detection as T & { box: BoundingBox }) : { ...detection, box: { ...FULL_FRAME_BOX } }));
}

export interface CoordinatorSourceUrl {
  role: StreamingRole;
  url: string;
}

export const MOTION_WIDTH_MAP: Record<MotionResolution, number> = {
  low: 320,
  medium: 480,
  high: 640,
};

export const DETECT_TIMEOUT_MS = 30_000;

export interface WorkerToMainMessage {
  message: 'started';
  data: Record<string, any>;
}

export interface FrameWorkerPerfSnapshot {
  elapsedMs: number;
  mainStreamEnabled: boolean;
  frameAnalysis: boolean;
  ticks: number;
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
