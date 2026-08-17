import type { Migration, MigrationContext } from './types.js';

const OBJECT_CONFIDENCE_PROPERTY = 'detectionSettings.object.confidence';
const OBJECT_LABELS = ['person', 'vehicle', 'animal'] as const;

interface LegacyObjectSettings {
  confidence?: number;
  confidences?: Record<string, number>;
}

async function splitObjectConfidence(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      const object = camera.detectionSettings?.object as LegacyObjectSettings | undefined;
      if (!object || object.confidences !== undefined) continue;

      const previous = typeof object.confidence === 'number' ? Math.min(Math.max(object.confidence, 0.3), 1) : 0.5;
      object.confidences = Object.fromEntries(OBJECT_LABELS.map((label) => [label, previous]));
      delete object.confidence;
      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": object confidence ${previous} now applies per label`);
    }
  });
}

async function splitAutomationProperty(ctx: MigrationContext): Promise<void> {
  await ctx.db.automationsDB.transaction(() => {
    for (const { key, value: automation } of ctx.db.automationsDB.getRange()) {
      let touched = false;

      for (const node of automation.nodes ?? []) {
        const properties = (node.data as { properties?: { property?: string }[] } | undefined)?.properties;
        if (!Array.isArray(properties)) continue;

        const mapped = properties.flatMap((entry) => {
          if (entry.property !== OBJECT_CONFIDENCE_PROPERTY) return [entry];
          return OBJECT_LABELS.map((label) => ({ ...entry, property: `detectionSettings.object.confidences.${label}` }));
        });
        if (mapped.length === properties.length) continue;

        (node.data as { properties?: unknown[] }).properties = mapped;
        touched = true;
      }

      if (!touched) continue;
      ctx.db.automationsDB.put(key, automation);
      ctx.logger.log(`Automation "${automation.name}": object confidence action now sets every label`);
    }
  });
}

const migration: Migration = {
  version: '2.1.13',
  description: 'object confidence becomes a per-label setting',
  async up(ctx) {
    await splitObjectConfidence(ctx);
    await splitAutomationProperty(ctx);
  },
};

export default migration;
