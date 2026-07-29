import { SensorType } from '@camera.ui/sdk';
import AudioIcon from '~icons/mdi/waveform';
import BatteryIcon from '~icons/mdi/battery-70';
import ClassifierIcon from '~icons/mdi/label-multiple-outline';
import ClipIcon from '~icons/mdi/image-search-outline';
import ContactIcon from '~icons/mdi/door';
import DoorbellIcon from '~icons/mdi/doorbell';
import FaceIcon from '~icons/mdi/face-recognition';
import GarageIcon from '~icons/mdi/garage';
import HumidityIcon from '~icons/mdi/water-percent';
import LeakIcon from '~icons/mdi/water-alert-outline';
import LicensePlateIcon from '~icons/mdi/car-search';
import LightIcon from '~icons/mdi/lightbulb-outline';
import LockIcon from '~icons/mdi/lock-outline';
import MotionIcon from '~icons/mdi/motion-sensor';
import ObjectAssistIcon from '~icons/mdi/cube-outline';
import ObjectIcon from '~icons/mdi/cube-scan';
import OccupancyIcon from '~icons/mdi/home-account';
import PtzIcon from '~icons/mdi/rotate-orbit';
import SecuritySystemIcon from '~icons/mdi/shield-home-outline';
import SirenIcon from '~icons/mdi/alarm-light-outline';
import SmokeIcon from '~icons/mdi/smoke-detector';
import SwitchIcon from '~icons/mdi/toggle-switch-outline';
import TemperatureIcon from '~icons/mdi/thermometer';

import type { Component } from 'vue';

export const SENSOR_TYPE_ICONS: Record<SensorType, Component> = {
  [SensorType.Motion]: MotionIcon,
  [SensorType.Object]: ObjectIcon,
  [SensorType.Audio]: AudioIcon,
  [SensorType.Face]: FaceIcon,
  [SensorType.LicensePlate]: LicensePlateIcon,
  [SensorType.Classifier]: ClassifierIcon,
  [SensorType.Clip]: ClipIcon,
  [SensorType.ObjectAssist]: ObjectAssistIcon,
  [SensorType.Contact]: ContactIcon,
  [SensorType.Temperature]: TemperatureIcon,
  [SensorType.Humidity]: HumidityIcon,
  [SensorType.Occupancy]: OccupancyIcon,
  [SensorType.Smoke]: SmokeIcon,
  [SensorType.Leak]: LeakIcon,
  [SensorType.Light]: LightIcon,
  [SensorType.Siren]: SirenIcon,
  [SensorType.Switch]: SwitchIcon,
  [SensorType.Lock]: LockIcon,
  [SensorType.PTZ]: PtzIcon,
  [SensorType.SecuritySystem]: SecuritySystemIcon,
  [SensorType.Garage]: GarageIcon,
  [SensorType.Doorbell]: DoorbellIcon,
  [SensorType.Battery]: BatteryIcon,
};

export function sensorTypeIcon(type: SensorType | string): Component {
  return SENSOR_TYPE_ICONS[type as SensorType] ?? MotionIcon;
}
