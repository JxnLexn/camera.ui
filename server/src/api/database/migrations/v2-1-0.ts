import { VIRTUAL_SENSOR_OWNER_ID, VIRTUAL_SENSOR_OWNER_NAME } from '../../../sensors/types.js';

import type { DBSensor } from '../types.js';
import type { Migration, MigrationContext } from './types.js';

const migration: Migration = {
  version: '2.1.0',
  description: 'standalone sensor entities: migrate virtual sensors, reset camera-scoped sensor references',

  async up(ctx: MigrationContext): Promise<void> {
    const { db, logger } = ctx;

    // virtual sensors -> DBSensor
    let migratedVirtual = 0;
    for (const { value } of db.virtualSensorsDB.getRange()) {
      const old = value;
      const record: DBSensor = {
        _id: old._id,
        pluginInfo: { id: VIRTUAL_SENSOR_OWNER_ID, name: VIRTUAL_SENSOR_OWNER_NAME },
        type: old.type,
        name: old.name,
        displayName: old.displayName,
        assignedCameraIds: old.cameraId ? [old.cameraId] : [],
        exposed: true,
        state: old.state ?? {},
        createdAt: old.createdAt,
        updatedAt: Date.now(),
      };
      await db.sensorsDB.put(record._id, record);
      await db.virtualSensorsDB.remove(old._id);
      migratedVirtual++;
    }
    if (migratedVirtual > 0) logger.log(`Migrated ${migratedVirtual} virtual sensors to standalone entities`);

    // cameras: old cascade trigger triples cannot be mapped to sensor ids
    for (const { key, value } of db.camerasDB.getRange()) {
      const camera = value;
      const triggers = camera.detectionSettings?.sensor?.triggers as unknown[] | undefined;
      if (triggers?.length && triggers.some((t) => typeof t !== 'string')) {
        camera.detectionSettings.sensor.triggers = [];
        await db.camerasDB.put(String(key), camera);
      }
    }

    // automation flows with sensor nodes: disable, user re-picks the sensor
    for (const { key, value } of db.automationsDB.getRange()) {
      const flow = value;
      const hasSensorNode = flow.nodes.some((node) => typeof node.data?.sensorName === 'string' && typeof node.data?.sensorPluginId === 'string');
      if (!hasSensorNode) continue;

      flow.enabled = false;
      flow.requiresUpdate = true;
      flow.updatedAt = Date.now();
      await db.automationsDB.put(String(key), flow);
      logger.log(`Automation "${flow.name}" disabled: sensor references need to be re-selected`);
    }

    // user preferences: sensor shortcuts reference the old composite key
    for (const { key, value } of db.usersDB.getRange()) {
      const user = value;
      const cameras = user.preferences?.cameras;
      if (!cameras) continue;

      let changed = false;
      for (const pref of Object.values(cameras)) {
        if (!pref?.shortcuts?.length) continue;
        const filtered = pref.shortcuts.filter((shortcut) => shortcut.type !== 'sensor');
        if (filtered.length !== pref.shortcuts.length) {
          pref.shortcuts = filtered;
          changed = true;
        }
      }
      if (changed) await db.usersDB.put(String(key), user);
    }
  },
};

export default migration;
