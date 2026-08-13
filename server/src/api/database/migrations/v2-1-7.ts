import type { Migration, MigrationContext } from './types.js';

const OBJECT_LABELS_PROPERTY = 'detectionSettings.object.labels';

interface LegacyObjectSettings {
  labels?: unknown;
}

async function dropCameraObjectLabels(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      const object = camera.detectionSettings?.object as LegacyObjectSettings | undefined;
      if (object?.labels === undefined) continue;
      delete object.labels;
      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": object types now come from the object zones`);
    }
  });
}

async function dropAutomationProperty(ctx: MigrationContext): Promise<void> {
  await ctx.db.automationsDB.transaction(() => {
    for (const { key, value: automation } of ctx.db.automationsDB.getRange()) {
      let touched = false;

      for (const node of automation.nodes ?? []) {
        const properties = (node.data as { properties?: { property?: string }[] } | undefined)?.properties;
        if (!Array.isArray(properties)) continue;

        const kept = properties.filter((entry) => entry.property !== OBJECT_LABELS_PROPERTY);
        if (kept.length === properties.length) continue;

        (node.data as { properties?: unknown[] }).properties = kept;
        touched = true;
      }

      if (!touched) continue;
      ctx.db.automationsDB.put(key, automation);
      ctx.logger.log(`Automation "${automation.name}": dropped the removed object types property`);
    }
  });
}

const migration: Migration = {
  version: '2.1.7',
  description: 'object types move from the camera settings into the object zones',
  async up(ctx) {
    await dropCameraObjectLabels(ctx);
    await dropAutomationProperty(ctx);
  },
};

export default migration;
