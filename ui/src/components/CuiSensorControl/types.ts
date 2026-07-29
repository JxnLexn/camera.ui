import { SensorType } from '@camera.ui/sdk';

const WIDGET_TYPES: ReadonlySet<SensorType> = new Set([
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
