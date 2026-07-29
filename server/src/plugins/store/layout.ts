const CANONICAL_SECTIONS = new Set(['plugin', 'cameras', 'sensors']);
const LEGACY_SENSOR_MARKER = ':sensor:';
const LAYOUT_VERSION_KEY = '__v';
const LAYOUT_VERSION = 2;

export function isCanonicalLayout(payload: Record<string, any>): boolean {
  return Object.keys(payload).every((key) => key === LAYOUT_VERSION_KEY || CANONICAL_SECTIONS.has(key));
}

function isGoLegacyLayout(payload: Record<string, any>, pluginId: string): boolean {
  const keys = Object.keys(payload);
  return keys.length > 0 && keys.every((key) => key.startsWith(`${pluginId}.`));
}

export function remapLegacyLayout(payload: Record<string, any>, pluginId: string): Record<string, any> {
  if (isGoLegacyLayout(payload, pluginId)) {
    return payload;
  }

  let canonical: Record<string, any>;
  if (isCanonicalLayout(payload)) {
    canonical = payload;
  } else {
    canonical = {};
    for (const section of CANONICAL_SECTIONS) {
      if (payload[section] !== undefined) {
        canonical[section] = payload[section];
      }
    }

    for (const [key, values] of Object.entries(payload)) {
      if (CANONICAL_SECTIONS.has(key) || key === LAYOUT_VERSION_KEY) {
        continue;
      }

      if (key === 'storage') {
        if (canonical.plugin !== undefined) {
          continue;
        }
        canonical.plugin = values;
        continue;
      }

      // <camId>:sensor:<type>:<pluginId>:<name> — pre-entity sensor storage,
      // no entity id to map onto, dropped below with the rest
      if (key.includes(LEGACY_SENSOR_MARKER)) {
        continue;
      }

      if (canonical.cameras?.[key] !== undefined) {
        continue;
      }
      canonical.cameras ??= {};
      canonical.cameras[key] = values;
    }
  }

  if (canonical[LAYOUT_VERSION_KEY] !== LAYOUT_VERSION) {
    if (canonical === payload) canonical = { ...payload };
    // camera-keyed sensor storage cannot be mapped to persistent sensor ids
    delete canonical.sensors;
    canonical[LAYOUT_VERSION_KEY] = LAYOUT_VERSION;
  }

  return canonical;
}
