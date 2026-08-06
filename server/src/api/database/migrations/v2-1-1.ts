import type { Migration, MigrationContext } from './types.js';

function isOnvifStreamProfile(url: string): boolean {
  if (!url.startsWith('onvif://')) return false;

  try {
    const query = new URL(url).searchParams;
    return query.has('subtype') && !query.has('snapshot');
  } catch {
    return false;
  }
}

async function dropStreamProfileSnapshotSources(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      const kept = camera.sources.filter((source) => !(source.role === 'snapshot' && source.urls.some(isOnvifStreamProfile)));
      if (kept.length === camera.sources.length) continue;

      camera.sources = kept;

      if (kept.length && !kept.some((source) => source.useForSnapshot)) {
        kept[0].useForSnapshot = true;
      }

      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": snapshots now come from "${kept[0]?.name}" instead of the MJPEG profile`);
    }
  });
}

const migration: Migration = {
  version: '2.1.1',
  description: 'snapshot sources pointing at an ONVIF MJPEG profile are dropped',
  async up(ctx) {
    await dropStreamProfileSnapshotSources(ctx);
  },
};

export default migration;
