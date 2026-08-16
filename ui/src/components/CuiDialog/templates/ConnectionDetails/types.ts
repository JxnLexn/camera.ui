import type { ConnectionAttempt } from '@/connection/attempts.js';

export interface ConnectionDetailsProps {
  currentType: string;
  currentAddress: string;
}

export interface AttemptRow extends ConnectionAttempt {
  modeLabel: string;
}
