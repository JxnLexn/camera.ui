import { checkMicrophonePermission } from '@/common/intercomService.js';
import { isCapacitor } from '@/connection/runtime.js';

export type AppPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';
export type AppPermissionName = 'microphone' | 'location' | 'notifications';

interface NativeSettingsPlugin {
  open(options: { optionAndroid: string; optionIOS: string }): Promise<void>;
}

const states = reactive<Record<AppPermissionName, AppPermissionState>>({
  microphone: 'unknown',
  location: 'unknown',
  notifications: 'unknown',
});

export function usePermissions() {
  const { isElectronApp, electron } = useElectron();

  const canOpenSettings = isCapacitor || isElectronApp;

  async function refresh(): Promise<void> {
    await Promise.all([refreshMicrophone(), refreshLocation(), refreshNotifications()]);
  }

  async function refreshMicrophone(): Promise<void> {
    if (isElectronApp && electron) {
      states.microphone = ((await electron.invoke('get-mic-access')) as AppPermissionState | undefined) ?? 'unknown';
      return;
    }
    if (isCapacitor) {
      const native = await checkMicrophonePermission();
      if (native) {
        states.microphone = native;
        return;
      }
    }
    states.microphone = await queryWeb('microphone');
  }

  async function refreshLocation(): Promise<void> {
    if (isCapacitor) {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        states.location = mapPluginState((await Geolocation.checkPermissions()).location);
      } catch {
        states.location = 'unknown';
      }
      return;
    }
    states.location = await queryWeb('geolocation');
  }

  async function refreshNotifications(): Promise<void> {
    if (isCapacitor) {
      try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        states.notifications = mapPluginState((await FirebaseMessaging.checkPermissions()).receive);
      } catch {
        states.notifications = 'unknown';
      }
      return;
    }
    if (typeof Notification === 'undefined') {
      states.notifications = 'unknown';
      return;
    }
    states.notifications = Notification.permission === 'default' ? 'prompt' : Notification.permission;
  }

  async function request(name: AppPermissionName): Promise<void> {
    if (name === 'microphone') {
      if (isElectronApp && electron) {
        await electron.invoke('ask-mic-access');
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
        } catch {
          // denied
        }
      }
      await refreshMicrophone();
      return;
    }

    if (name === 'location') {
      if (isCapacitor) {
        try {
          const { Geolocation } = await import('@capacitor/geolocation');
          await Geolocation.requestPermissions({ permissions: ['location'] });
        } catch {
          // denied
        }
      } else {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            () => resolve(),
            { timeout: 10_000 },
          );
        });
      }
      await refreshLocation();
      return;
    }

    if (isCapacitor) {
      try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        await FirebaseMessaging.requestPermissions();
      } catch {
        // denied
      }
    } else if (typeof Notification !== 'undefined') {
      await Notification.requestPermission();
    }
    await refreshNotifications();
  }

  async function openSettings(): Promise<void> {
    if (isCapacitor) {
      const { registerPlugin } = await import('@capacitor/core');
      const nativeSettings = registerPlugin<NativeSettingsPlugin>('NativeSettings');
      await nativeSettings.open({ optionAndroid: 'application_details', optionIOS: 'app' });
      return;
    }
    if (isElectronApp && electron) {
      await electron.invoke('open-mic-settings');
    }
  }

  return { states, canOpenSettings, refresh, request, openSettings };
}

function mapPluginState(state: string): AppPermissionState {
  switch (state) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
    case 'prompt-with-rationale':
      return 'prompt';
    default:
      return 'unknown';
  }
}

async function queryWeb(name: 'microphone' | 'geolocation'): Promise<AppPermissionState> {
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    if (status.state === 'granted') return 'granted';
    if (status.state === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unknown';
  }
}
