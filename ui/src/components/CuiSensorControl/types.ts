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

// binary state sensors without a dedicated widget: rendered by CuiBinarySensor
export const BINARY_SENSOR_TYPES: ReadonlySet<SensorType> = new Set([
  SensorType.Gas,
  SensorType.CarbonMonoxide,
  SensorType.Heat,
  SensorType.Cold,
  SensorType.Vibration,
  SensorType.Tamper,
  SensorType.Problem,
  SensorType.Power,
]);

// measurement sensors rendered by CuiMeasurementInfo, value suffixed with the unit
export const MEASUREMENT_UNITS: ReadonlyMap<SensorType, string> = new Map([
  [SensorType.Illuminance, 'lx'],
  [SensorType.CarbonDioxide, 'ppm'],
]);

const WIDGET_TYPES: ReadonlySet<SensorType> = new Set([
  ...DETECTION_INFO_TYPES,
  ...BINARY_SENSOR_TYPES,
  ...MEASUREMENT_UNITS.keys(),
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
