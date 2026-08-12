import type { AlertZone, DetectionLine, DetectionZone } from '@camera.ui/sdk';

export type ZoneEditorTab = 'zones' | 'alerts' | 'lines';

export type EditorPolygon = DetectionZone | AlertZone;

export interface ZoneEditorProps {
  cameraName: string;
  zones: DetectionZone[];
  alerts: AlertZone[];
  lines: DetectionLine[];
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

export const NON_SPATIAL_LABELS = ['audio'];
export const NON_TRACKED_LABELS = ['audio', 'motion'];
