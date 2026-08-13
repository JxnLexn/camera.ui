import type { DetectionLine, ObjectZone, PrivacyZone } from '@camera.ui/sdk';

export interface CuiPolygonProps {
  cameraZones: ObjectZone[];
  cameraLines?: DetectionLine[];
  privacyZones?: PrivacyZone[];
}
