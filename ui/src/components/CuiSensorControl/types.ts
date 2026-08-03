import { SensorType } from '@camera.ui/sdk';

// read-only state widget for detection sensors: detected + current labels
export const DETECTION_INFO_TYPES: ReadonlySet<SensorType> = new Set([
  SensorType.Motion,
  SensorType.Object,
  SensorType.Audio,
  SensorType.Face,
  SensorType.LicensePlate,
  SensorType.Classifier,
]);

const WIDGET_TYPES: ReadonlySet<SensorType> = new Set([
  ...DETECTION_INFO_TYPES,
  SensorType.Light,
  SensorType.Switch,
  SensorType.Lock,
  SensorType.Siren,
  SensorType.SecuritySystem,
  SensorType.Garage,
  SensorType.Doorbell,
  SensorType.Contact,
  SensorType.Occupancy,
  SensorType.Smoke,
  SensorType.Leak,
  SensorType.Temperature,
  SensorType.Humidity,
  SensorType.Battery,
]);

export function hasSensorControlWidget(type: SensorType | string): boolean {
  return WIDGET_TYPES.has(type as SensorType);
}
