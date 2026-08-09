import { isCapacitor } from '@/connection/runtime.js';

interface PipChangedEvent {
  active: boolean;
}

interface PipPlugin {
  enter(options: { width: number; height: number }): Promise<{ entered: boolean }>;
  setAutoEnter(options: { enabled: boolean; width: number; height: number }): Promise<void>;
  addListener(event: 'pipChanged', cb: (data: PipChangedEvent) => void): Promise<{ remove: () => Promise<void> }>;
  addListener(event: 'pipWillEnter' | 'pipEnterFailed', cb: () => void): Promise<{ remove: () => Promise<void> }>;
}

export interface AutoPipCandidate {
  width: number;
  height: number;
  activate: (active: boolean) => void;
}

const log = useLogger();

export const nativePipActive = ref(false);

let pluginPromise: Promise<{ plugin: PipPlugin | null }> | null = null;
let listenerInstalled = false;
const autoCandidates = new Map<string, AutoPipCandidate>();
let armedId: string | null = null;

function getPlugin(): Promise<{ plugin: PipPlugin | null }> {
  pluginPromise ??= (async () => {
    if (!isCapacitor) return { plugin: null };
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'android') return { plugin: null };
    return { plugin: registerPlugin<PipPlugin>('Pip') };
  })();
  return pluginPromise;
}

async function ensureListener(plugin: PipPlugin): Promise<void> {
  if (listenerInstalled) return;
  listenerInstalled = true;
  await plugin.addListener('pipChanged', (event) => {
    setPipActive(event.active);
    if (event.active && armedId) autoCandidates.get(armedId)?.activate(true);
  });
  await plugin.addListener('pipWillEnter', () => {
    setPipActive(true);
    if (armedId) autoCandidates.get(armedId)?.activate(true);
  });
  await plugin.addListener('pipEnterFailed', () => {
    setPipActive(false);
  });
}

export async function enterNativePip(width: number, height: number): Promise<boolean> {
  try {
    const { plugin } = await getPlugin();
    if (!plugin) return false;

    await ensureListener(plugin);

    setPipActive(true);
    await nextPaint();

    const entered = (await plugin.enter({ width, height })).entered;
    if (!entered) setPipActive(false);
    return entered;
  } catch (error) {
    setPipActive(false);
    log.warn('Pip.enter failed', error);
    return false;
  }
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function registerAutoPipCandidate(id: string, candidate: AutoPipCandidate): void {
  autoCandidates.set(id, candidate);
  syncAutoPip();
}

export function unregisterAutoPipCandidate(id: string): void {
  if (!autoCandidates.delete(id)) return;
  syncAutoPip();
}

async function syncAutoPip(): Promise<void> {
  try {
    const { plugin } = await getPlugin();
    if (!plugin) return;

    await ensureListener(plugin);

    const only = autoCandidates.size === 1 ? [...autoCandidates.entries()][0]! : null;
    armedId = only?.[0] ?? null;
    await plugin.setAutoEnter(only ? { enabled: true, width: only[1].width, height: only[1].height } : { enabled: false, width: 16, height: 9 });
  } catch (error) {
    log.warn('Pip.setAutoEnter failed', error);
  }
}

function setPipActive(active: boolean): void {
  nativePipActive.value = active;
  document.documentElement.classList.toggle('cui-native-pip', active);
}
