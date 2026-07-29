import type { TransformedSensor } from '@shared/types';

export interface SensorEditProps {
  sensor: TransformedSensor;
  cameraOptions: { label: string; value: string }[];
}

export interface SensorEditResult {
  displayName: string;
  assignedCameraIds: string[];
  exposed: boolean;
}
