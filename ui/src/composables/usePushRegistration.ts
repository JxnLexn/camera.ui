import { registerNotifierDeviceFn } from '@/api/routes/notifications.js';
import { getPushDeviceId } from '@/common/deviceId';
import { getCurrentServerId, isCapacitor } from '@/connection/index.js';

const log = useLogger('PushRegistration');

const MOBILE_PLUGIN_NAME = '@camera.ui/camera-ui-nvr';
const PREF_KEY_REGISTRATIONS = 'cui.push.registrations';

interface PerServerRegistration {
  deviceId: string;
  enabledAt: number;
}

interface PushCryptoPlugin {
  getOrCreateKey(options: { serverId: string }): Promise<{ key: string }>;
  deleteKey(options: { serverId: string }): Promise<void>;
}

type PushRegistrations = Record<string, PerServerRegistration>;

const _registering = ref(false);

export function usePushRegistration() {
  const registerForPush = async (): Promise<void> => {
    if (!isCapacitor || _registering.value) return;
    _registering.value = true;

    try {
      const serverId = getCurrentServerId();
      if (!serverId) return;

      const deviceId = await getPushDeviceId();
      if (!deviceId) return;

      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const perm = await FirebaseMessaging.requestPermissions();
      if (perm.receive !== 'granted') log.warn('push permission not granted:', perm.receive);

      const platform = await detectPlatform();
      const deviceName = await detectDeviceName();
      const pushKey = await getOrCreatePushKey(serverId);

      const device = await registerNotifierDeviceFn({
        pluginName: MOBILE_PLUGIN_NAME,
        input: { deviceId, platform, deviceName, ...(pushKey ? { pushKey } : {}) },
      });

      await writeRegistration(serverId, { deviceId: device.id, enabledAt: Date.now() });
    } catch (err) {
      log.warn('failed to enable push for server:', err);
    } finally {
      _registering.value = false;
    }
  };

  const forgetIfThisDevice = async (serverId: string, deviceId: string): Promise<void> => {
    if (!serverId) return;
    const reg = await readRegistration(serverId);
    if (!reg || reg.deviceId !== deviceId) return;
    await removeRegistration(serverId);
    await deletePushKey(serverId);
  };

  const isServerSynced = async (serverId: string): Promise<boolean> => {
    if (!serverId) return false;
    return (await readRegistration(serverId)) !== null;
  };

  return {
    registerForPush,
    forgetIfThisDevice,
    isServerSynced,
  };
}

async function readRegistrations(): Promise<PushRegistrations> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: PREF_KEY_REGISTRATIONS });
    if (!value) return {};
    return JSON.parse(value) as PushRegistrations;
  } catch {
    return {};
  }
}

async function writeRegistrations(regs: PushRegistrations): Promise<void> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: PREF_KEY_REGISTRATIONS, value: JSON.stringify(regs) });
  } catch {
    // Best-effort
  }
}

async function readRegistration(serverId: string): Promise<PerServerRegistration | null> {
  const regs = await readRegistrations();
  return regs[serverId] ?? null;
}

async function writeRegistration(serverId: string, entry: PerServerRegistration): Promise<void> {
  const regs = await readRegistrations();
  regs[serverId] = entry;
  await writeRegistrations(regs);
}

async function removeRegistration(serverId: string): Promise<void> {
  const regs = await readRegistrations();
  if (!regs[serverId]) return;
  delete regs[serverId];
  await writeRegistrations(regs);
}

async function pushCrypto(): Promise<PushCryptoPlugin | null> {
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (!Capacitor.isPluginAvailable('PushCrypto')) return null;
    return registerPlugin<PushCryptoPlugin>('PushCrypto');
  } catch {
    return null;
  }
}

async function getOrCreatePushKey(serverId: string): Promise<string | null> {
  try {
    const plugin = await pushCrypto();
    if (!plugin) return null;
    const { key } = await plugin.getOrCreateKey({ serverId });
    return key || null;
  } catch (err) {
    log.warn('push key unavailable, falling back to plaintext push:', err);
    return null;
  }
}

async function deletePushKey(serverId: string): Promise<void> {
  try {
    await (await pushCrypto())?.deleteKey({ serverId });
  } catch {
    // best-effort
  }
}

async function detectPlatform(): Promise<'ios' | 'android'> {
  const { Capacitor } = await import('@capacitor/core');
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
}

async function detectDeviceName(): Promise<string> {
  let model = '';

  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getInfo();
    model = info.name || info.model || '';
  } catch {
    // ignore — we'll fall through to the platform-name default below
  }

  if (!model) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      model = Capacitor.getPlatform() === 'ios' ? 'iPhone' : 'Android';
    } catch {
      model = 'Mobile';
    }
  }

  const auth = useAuthStore();
  const username = auth.user?.username;
  return username ? `${model} (${username})` : model;
}
