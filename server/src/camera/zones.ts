import type { CameraZones } from '@camera.ui/sdk';

export function normalizeZones(zones?: Partial<CameraZones> | null): CameraZones {
  return {
    privacyFallback: zones?.privacyFallback ?? 'send',
    motion: zones?.motion ?? [],
    object: zones?.object ?? [],
    privacy: zones?.privacy ?? [],
    alert: zones?.alert ?? [],
    lines: zones?.lines ?? [],
  };
}
