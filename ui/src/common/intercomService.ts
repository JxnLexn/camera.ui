import { isCapacitor } from '@/connection/runtime.js';

interface IntercomServicePlugin {
  start(): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
  checkMicrophone(): Promise<{ state: 'granted' | 'prompt' }>;
}

const log = useLogger();

let pluginPromise: Promise<{ plugin: IntercomServicePlugin | null }> | null = null;

function getPlugin(): Promise<{ plugin: IntercomServicePlugin | null }> {
  pluginPromise ??= (async () => {
    if (!isCapacitor) return { plugin: null };
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'android') return { plugin: null };
    return { plugin: registerPlugin<IntercomServicePlugin>('IntercomService') };
  })();
  return pluginPromise;
}

export async function startIntercomService(): Promise<void> {
  try {
    const { plugin } = await getPlugin();
    if (!plugin) return;
    await plugin.start();
  } catch (error) {
    log.warn('IntercomService.start failed', error);
  }
}

export async function stopIntercomService(): Promise<void> {
  try {
    const { plugin } = await getPlugin();
    if (!plugin) return;
    await plugin.stop();
  } catch (error) {
    log.warn('IntercomService.stop failed', error);
  }
}

export async function checkMicrophonePermission(): Promise<'granted' | 'prompt' | null> {
  try {
    const { plugin } = await getPlugin();
    if (!plugin) return null;
    return (await plugin.checkMicrophone()).state;
  } catch (error) {
    log.warn('IntercomService.checkMicrophone failed', error);
    return null;
  }
}
