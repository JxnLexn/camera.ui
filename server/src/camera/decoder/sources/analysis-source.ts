import type { HardwareContext } from 'node-av/api';
import type { Frame } from 'node-av/lib';

export interface FrameSnap {
  frame: Frame;
  id: number;
}

export interface AnalysisSource {
  readonly hardwareContext?: HardwareContext | null;
  nextFrame(lastId: number): Promise<FrameSnap | undefined>;
}
