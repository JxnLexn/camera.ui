import { HardwareContext } from 'node-av/api';

import type { Logger } from '@camera.ui/common/logger';
import type { FrameWorkerDecoderSettings } from '@camera.ui/sdk';
import type { FFHWDeviceType } from 'node-av/constants';

export function createHardwareContext(decoder: FrameWorkerDecoderSettings | undefined, logger: Logger): HardwareContext | null {
  const hardware = decoder?.hardware ?? 'auto';
  if (hardware === 'cpu') return null;

  if (hardware !== 'auto') {
    let device = decoder?.device?.trim();
    if (device === '') device = undefined;
    const context = HardwareContext.create(hardware as FFHWDeviceType, device);
    if (context) return context;
    logger.warn(`Configured decoder hardware "${hardware}${device ? ` (${device})` : ''}" is not usable on this machine, falling back to auto`);
  }

  return HardwareContext.auto();
}
