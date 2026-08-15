import type { CameraZones, DetectionLabel, MotionZone, ObjectZone, Point, PrivacyZone, ZoneType } from '@camera.ui/sdk';
import type { Migration, MigrationContext } from './types.js';

type LegacyZoneFilter = 'include' | 'exclude';

interface LegacyZone {
  name: string;
  points: Point[];
  type: ZoneType;
  filter: LegacyZoneFilter;
  labels: DetectionLabel[];
  isPrivacyMask: boolean;
  color: string;
}

interface LegacyCamera {
  detectionZones?: LegacyZone[];
  alertZones?: unknown[];
  detectionLines?: unknown[];
}

function splitZones(zones: LegacyZone[]): { motion: MotionZone[]; object: ObjectZone[]; privacy: PrivacyZone[] } {
  const motion: MotionZone[] = [];
  const object: ObjectZone[] = [];
  const privacy: PrivacyZone[] = [];

  for (const zone of zones) {
    if (zone.isPrivacyMask) {
      privacy.push({ name: zone.name, points: zone.points, dropDetections: true });
      continue;
    }

    const labels = zone.labels ?? [];
    const all = labels.length === 0;
    const objectLabels = labels.filter((label: string) => label !== 'motion');

    if (all || labels.includes('motion')) {
      motion.push({ name: zone.name, points: zone.points, filter: zone.filter, color: zone.color } as MotionZone & { filter: LegacyZoneFilter });
    }
    if (all || objectLabels.length > 0) {
      object.push({
        name: zone.name,
        points: zone.points,
        type: zone.type,
        filter: zone.filter,
        labels: all ? [] : objectLabels,
        color: zone.color,
      } as ObjectZone & { filter: LegacyZoneFilter });
    }
  }

  return { motion, object, privacy };
}

async function migrateZones(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      const legacy = camera as unknown as LegacyCamera;
      const zones = legacy.detectionZones ?? [];
      const migrated = camera.zones ? Object.values(camera.zones).some((value) => Array.isArray(value) && value.length > 0) : false;
      if (zones.length === 0 || migrated) continue;

      const { motion, object, privacy } = splitZones(zones);
      camera.zones = {
        privacyFallback: 'send',
        motion,
        object,
        privacy,
        alert: (legacy.alertZones ?? []) as CameraZones['alert'],
        lines: (legacy.detectionLines ?? []) as CameraZones['lines'],
      };
      delete legacy.detectionZones;
      delete legacy.alertZones;
      delete legacy.detectionLines;

      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": ${zones.length} zone(s) split into ${motion.length} motion, ${object.length} object, ${privacy.length} privacy`);
    }
  });
}

const migration: Migration = {
  version: '2.1.6',
  description: 'detection zones split into motion, object and privacy zones',
  async up(ctx) {
    await migrateZones(ctx);
  },
};

export default migration;
