import type { AlertZone, CameraZones, DetectionLine, MotionZone, ObjectZone, PrivacyZone } from '@camera.ui/sdk';

export type ZoneEditorTab = 'motion' | 'object' | 'alert' | 'privacy' | 'lines';

export type EditorPolygon = MotionZone | ObjectZone | AlertZone | PrivacyZone;

export interface ZoneEditorProps {
  cameraName: string;
  zones: CameraZones;
  initialTab?: ZoneEditorTab;
  initialSelection?: number;
}

export interface CoordsPosition {
  _id: string;
  zoneIndex: number;
  pointIndex: number;
  point: [number, number];
}

export interface LabelOption {
  label: string;
  value: string;
}

export interface LabelGroup {
  label: string;
  items: LabelOption[];
}

export type { DetectionLine };

export const NON_SPATIAL_LABELS = ['audio'];
export const NON_TRACKED_LABELS = ['audio', 'motion'];
