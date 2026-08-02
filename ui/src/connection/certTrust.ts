import type { Endpoint } from '@camera.ui/transport';

export type CertTrustInstaller = (ca: string, hosts: readonly string[]) => Promise<void> | void;

let installer: CertTrustInstaller | null = null;

export function setCertTrustInstaller(fn: CertTrustInstaller | null): void {
  installer = fn;
}

export function hasCertTrustInstaller(): boolean {
  return installer !== null;
}

export async function trustInternalCa(ca: string | undefined, pool: readonly Endpoint[]): Promise<void> {
  if (!installer || !ca) return;

  const hosts = [
    ...new Set(
      pool
        .filter((endpoint) => endpoint.mode === 'direct-lan')
        .map(hostOf)
        .filter((host): host is string => Boolean(host)),
    ),
  ];
  if (hosts.length === 0) return;

  try {
    await installer(ca, hosts);
  } catch {
    // trust stays as it is, the race falls back to the external endpoints
  }
}

function hostOf(endpoint: Endpoint): string | null {
  try {
    const hostname = new URL(endpoint.url).hostname;
    if (!hostname) return null;
    return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  } catch {
    return null;
  }
}
