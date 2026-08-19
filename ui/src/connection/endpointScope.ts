import type { Endpoint } from '@camera.ui/transport';
import type { ConnectionMode } from './types.js';

const PRIVATE_IPV4 = /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;
const UNIQUE_LOCAL_IPV6 = /^f[cd][0-9a-f]{2}:/;
const LOCAL_SUFFIXES = ['.local', '.lan', '.home', '.internal', '.localdomain'];

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function isLanHostname(hostname: string): boolean {
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (host === 'localhost') return true;
  if (host.includes(':')) return host === '::1' || UNIQUE_LOCAL_IPV6.test(host) || host.startsWith('fe80:');
  if (PRIVATE_IPV4.test(host)) return true;
  if (!host.includes('.')) return true;
  return LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function isLanEndpoint(url: string | undefined): boolean {
  const hostname = url ? hostnameOf(url) : undefined;
  return hostname ? isLanHostname(hostname) : false;
}

export function isLanTarget(endpoint: Endpoint | undefined, bootMode: ConnectionMode): boolean {
  if (!endpoint) return false;
  if (bootMode !== 'direct') return endpoint.mode === 'direct-lan';
  return isLanEndpoint(endpoint.url);
}
