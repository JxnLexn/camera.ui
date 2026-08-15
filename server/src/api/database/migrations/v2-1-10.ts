import type { Migration, MigrationContext } from './types.js';

async function dropExcludeZones(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      const zones = camera.zones;
      if (!zones) continue;

      let removed = 0;
      for (const kind of ['motion', 'object'] as const) {
        const list = zones[kind] as ({ filter?: string } & { name: string })[] | undefined;
        if (!Array.isArray(list)) continue;

        const kept = list.filter((zone) => zone.filter !== 'exclude');
        removed += list.length - kept.length;
        for (const zone of kept) delete zone.filter;
        zones[kind] = kept as never;
      }

      if (removed === 0) continue;
      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": removed ${removed} exclude zone(s), zones only include now`);
    }
  });
}

const migration: Migration = {
  version: '2.1.10',
  description: 'zones lose the include/exclude mode, exclude zones are removed',
  async up(ctx) {
    await dropExcludeZones(ctx);
  },
};

export default migration;
