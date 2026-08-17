import { setCertTrustInstaller } from '@/connection/index.js';
import { isCapacitor } from '@/connection/runtime.js';

interface CertTrustPlugin {
  trust(options: { ca: string; hosts: string[] }): Promise<void>;
  clear(): Promise<void>;
}

const log = useLogger();

let plugin: CertTrustPlugin | null = null;

export function installCertTrustBridge(): void {
  if (!isCapacitor) return;

  setCertTrustInstaller(async (ca, hosts) => {
    if (!plugin) {
      const { registerPlugin } = await import('@capacitor/core');
      plugin = registerPlugin<CertTrustPlugin>('CertTrust');
    }
    await plugin.trust({ ca, hosts: [...hosts] });
    log.debug(`[cert-trust] instance CA trusted for ${hosts.length} host(s)`);
  });
}
