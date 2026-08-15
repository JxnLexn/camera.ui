import type { Migration, MigrationContext } from './types.js';

async function dropPackageFromLines(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      const lines = camera.zones?.lines;
      if (!Array.isArray(lines) || lines.length === 0) continue;

      const kept = lines.filter((line) => !(Array.isArray(line.labels) && line.labels.length === 1 && line.labels[0] === 'package'));
      let touched = kept.length !== lines.length;

      for (const line of kept) {
        if (!Array.isArray(line.labels) || !line.labels.includes('package')) continue;
        line.labels = line.labels.filter((label) => label !== 'package');
        touched = true;
      }

      if (!touched) continue;
      camera.zones.lines = kept;
      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": line crossing no longer offers packages`);
    }
  });
}

const migration: Migration = {
  version: '2.1.11',
  description: 'line crossing loses the package label',
  async up(ctx) {
    await dropPackageFromLines(ctx);
  },
};

export default migration;
