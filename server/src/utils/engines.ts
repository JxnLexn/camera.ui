import { PROTOCOL_LEVEL } from '@camera.ui/sdk';
import semver from 'semver';

import type { EngineIssue, ProtocolCompat } from '../api/types/index.js';

export const MIN_SUPPORTED_PROTOCOL_LEVEL = 1;

export function checkProtocolCompat(protocolLevel: unknown): ProtocolCompat {
  if (typeof protocolLevel !== 'number') return 'unknown';
  if (protocolLevel < MIN_SUPPORTED_PROTOCOL_LEVEL) return 'pluginTooOld';
  if (protocolLevel > PROTOCOL_LEVEL) return 'serverTooOld';
  return 'compatible';
}

export function checkEngineCompatibility(engines: Record<string, string> | undefined, hostVersion: string, nodeVersion: string): EngineIssue[] {
  if (!engines) {
    return [];
  }

  const issues: EngineIssue[] = [];

  const checks: { engine: EngineIssue['engine']; current: string }[] = [
    { engine: 'camera.ui', current: hostVersion },
    { engine: 'node', current: nodeVersion.replace(/^v/, '') },
  ];

  for (const { engine, current } of checks) {
    const required = engines[engine];

    if (!required || !semver.validRange(required, { loose: true })) {
      continue;
    }

    const coerced = semver.coerce(current);

    if (coerced && !semver.satisfies(coerced.version, required, { loose: true })) {
      issues.push({ engine, required, current });
    }
  }

  return issues;
}
