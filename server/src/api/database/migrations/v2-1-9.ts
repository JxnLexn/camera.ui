import type { ZoneLabel } from '@camera.ui/sdk';
import type { Migration, MigrationContext } from './types.js';

const PARENT_TO_ATTRIBUTE: Partial<Record<ZoneLabel, ZoneLabel>> = {
  person: 'face',
  vehicle: 'license_plate',
};

async function keepIdentifyingInObjectZones(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      const zones = camera.zones?.object;
      if (!Array.isArray(zones) || zones.length === 0) continue;

      let touched = false;
      for (const zone of zones) {
        // an empty list already means "every label", nothing to carry over
        if (!Array.isArray(zone.labels) || zone.labels.length === 0) continue;

        for (const [parent, attribute] of Object.entries(PARENT_TO_ATTRIBUTE) as [ZoneLabel, ZoneLabel][]) {
          if (!zone.labels.includes(parent) || zone.labels.includes(attribute)) continue;
          zone.labels.push(attribute);
          touched = true;
        }
      }

      if (!touched) continue;
      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": object zones keep recognizing faces and plates`);
    }
  });
}

const migration: Migration = {
  version: '2.1.9',
  description: 'object zones can switch off face and plate recognition per area',
  async up(ctx) {
    await keepIdentifyingInObjectZones(ctx);
  },
};

export default migration;
