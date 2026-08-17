import type { ClassifierDetection, Detection, DetectionLabel, FaceDetection, LicensePlateDetection, TrackedDetection } from '@camera.ui/sdk';

export type AnyDetection = Detection | TrackedDetection | FaceDetection | LicensePlateDetection | ClassifierDetection;

export interface CuiBBoxPlaygroundProps {
  showIcon?: boolean;
  showLabel?: boolean;
  showConfidence?: boolean;
  highlightArea?: boolean;
  detections?: AnyDetection[];
  classes?: DetectionLabel[];
}
