const LAYOUT_VERSION_KEY = '__v';
// v2: sensors keyed by persistent sensor id, pre-entity camera-keyed trees are unmappable
const LAYOUT_VERSION = 2;

export function upgradeStoreLayout(payload: Record<string, any>): Record<string, any> {
  if (payload[LAYOUT_VERSION_KEY] === LAYOUT_VERSION) {
    return payload;
  }

  const upgraded = { ...payload };
  delete upgraded.sensors;
  upgraded[LAYOUT_VERSION_KEY] = LAYOUT_VERSION;
  return upgraded;
}
