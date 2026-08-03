import type { SensorType } from '@camera.ui/sdk';

export interface CuiDetectionSensorInfoProps {
  type: SensorType | string;
  label?: string;
  detected?: boolean;
  labels?: string[];
  decibels?: number;
  size?: 'small' | 'medium' | 'large';
}

export const CUI_DETECTION_SENSOR_INFO_DEFAULTS = {
  detected: false,
  size: 'medium',
} as const;
