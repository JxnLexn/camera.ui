import type { Migration, MigrationContext } from './types.js';

interface LabeledZone {
  name?: string;
  labels?: string[];
}

function stripPackage(zones: unknown): { kept: LabeledZone[]; touched: boolean; removed: string[] } {
  if (!Array.isArray(zones)) return { kept: [], touched: false, removed: [] };

  let touched = false;
  const removed: string[] = [];
  const kept: LabeledZone[] = [];
  for (const zone of zones as LabeledZone[]) {
    if (!Array.isArray(zone.labels) || !zone.labels.includes('package')) {
      kept.push(zone);
      continue;
    }
    touched = true;
    const labels = zone.labels.filter((label) => label !== 'package');
    if (labels.length === 0) {
      removed.push(zone.name ?? 'unnamed');
      continue;
    }
    zone.labels = labels;
    kept.push(zone);
  }
  return { kept, touched, removed };
}

async function dropPackageFromCameras(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      let touched = false;
      const notes: string[] = [];

      for (const kind of ['object', 'alert'] as const) {
        const zones = camera.zones?.[kind];
        const result = stripPackage(zones);
        if (!result.touched) continue;
        (camera.zones as unknown as Record<string, unknown>)[kind] = result.kept;
        touched = true;
        if (result.removed.length > 0) notes.push(`removed ${kind} zone(s) ${result.removed.join(', ')}`);
      }

      const targets = camera.ptzAutotrack?.targetLabels as string[] | undefined;
      if (Array.isArray(targets) && targets.includes('package')) {
        const kept = targets.filter((label) => label !== 'package');
        camera.ptzAutotrack.targetLabels = kept.length > 0 ? kept : ['person'];
        touched = true;
      }

      const confidences = camera.detectionSettings?.object?.confidences as Record<string, number> | undefined;
      if (confidences && 'package' in confidences) {
        delete confidences.package;
        touched = true;
      }

      if (!touched) continue;
      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": package label retired${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`);
    }
  });
}

async function dropPackageFromAutomations(ctx: MigrationContext): Promise<void> {
  await ctx.db.automationsDB.transaction(() => {
    for (const { key, value: automation } of ctx.db.automationsDB.getRange()) {
      let touched = false;
      let widened = false;

      for (const node of automation.nodes ?? []) {
        const labels = (node.data as { detectionLabels?: string[] } | undefined)?.detectionLabels;
        if (!Array.isArray(labels) || !labels.includes('package')) continue;
        const kept = labels.filter((label) => label !== 'package');
        (node.data as { detectionLabels?: string[] }).detectionLabels = kept;
        touched = true;
        if (kept.length === 0) widened = true;
      }

      if (!touched) continue;
      ctx.db.automationsDB.put(key, automation);
      ctx.logger.log(`Automation "${automation.name}": package label retired${widened ? ', a trigger now matches any type — check it' : ''}`);
    }
  });
}

const migration: Migration = {
  version: '2.1.14',
  description: 'the package label retires from zones, autotracking and automations',
  async up(ctx) {
    await dropPackageFromCameras(ctx);
    await dropPackageFromAutomations(ctx);
  },
};

export default migration;
