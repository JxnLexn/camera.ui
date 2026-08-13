import type { CameraDetectionSettings, CameraFrameWorkerSettings, CameraUiSettings, CameraZones, PtzAutotrackSettings } from '@camera.ui/sdk';
import type { DetectionCoordinatorConfig } from '../../camera/decoder/detection-coordinator.js';
import type { FrameWorkerPerfSnapshot } from '../../camera/decoder/types.js';

export interface FrameWorkerChildInterface {
  initialize(config: DetectionCoordinatorConfig): Promise<void>;
  updateZoneConfig(zones: CameraZones): void;
  updateDetectionSettings(settings: CameraDetectionSettings): void;
  updatePtzAutotrackSettings(settings: PtzAutotrackSettings): void;
  updateFrameWorkerSettings(settings: CameraFrameWorkerSettings): void;
  updateInterfaceSettings(settings: CameraUiSettings): void;
  updateCameraName(name: string): void;
  updateNvrRpc(namespace?: string): void;
  getPerfSnapshot(): FrameWorkerPerfSnapshot | null;
}
