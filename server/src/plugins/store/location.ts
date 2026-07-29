export type StoreLocation = { kind: 'plugin' } | { kind: 'camera'; cameraId: string } | { kind: 'sensor'; pluginId: string; sensorId: string };

export function readLocation(config: Record<string, any>, location: StoreLocation): Record<string, any> | undefined {
  switch (location.kind) {
    case 'plugin':
      return config.plugin;
    case 'camera':
      return config.cameras?.[location.cameraId];
    case 'sensor':
      return config.sensors?.[location.sensorId];
  }
}

export function writeLocation(config: Record<string, any>, location: StoreLocation, values: Record<string, any>): void {
  switch (location.kind) {
    case 'plugin':
      config.plugin = values;
      return;
    case 'camera':
      config.cameras ??= {};
      config.cameras[location.cameraId] = values;
      return;
    case 'sensor':
      config.sensors ??= {};
      config.sensors[location.sensorId] = values;
      return;
  }
}

export function deleteLocation(config: Record<string, any>, location: StoreLocation): void {
  switch (location.kind) {
    case 'plugin':
      delete config.plugin;
      return;
    case 'camera':
      delete config.cameras?.[location.cameraId];
      pruneIfEmpty(config, 'cameras');
      return;
    case 'sensor':
      delete config.sensors?.[location.sensorId];
      pruneIfEmpty(config, 'sensors');
      return;
  }
}

function pruneIfEmpty(parent: Record<string, any>, key: string): void {
  const child = parent[key];
  if (child && typeof child === 'object' && Object.keys(child).length === 0) {
    delete parent[key];
  }
}
