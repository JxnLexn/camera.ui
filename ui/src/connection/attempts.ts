import type { EndpointMode } from '@camera.ui/transport';
import type { ShallowRef } from 'vue';

export type AttemptOutcome = 'connected' | 'failed' | 'superseded' | 'pending';

export interface ConnectionAttempt {
  readonly url: string;
  readonly mode: EndpointMode;
  readonly startedAt: number;
  readonly durationMs?: number;
  readonly outcome: AttemptOutcome;
  readonly reason?: string;
}

export interface ConnectionRound {
  readonly startedAt: number;
  readonly attempts: ConnectionAttempt[];
  readonly result?: 'connected' | 'failed';
  readonly reason?: string;
}

export interface ConnectionAttemptLog {
  readonly rounds: ShallowRef<ConnectionRound[]>;
  roundStarted(): void;
  probeStarted(url: string, mode: EndpointMode): void;
  probeSucceeded(url: string): void;
  probeFailed(url: string, reason: string): void;
  roundFailed(reason: string): void;
  clear(): void;
}

const MAX_ROUNDS = 5;

export function createConnectionAttemptLog(now: () => number = Date.now): ConnectionAttemptLog {
  const rounds = shallowRef<ConnectionRound[]>([]);

  function updateCurrent(patch: (round: ConnectionRound) => ConnectionRound): void {
    const [current, ...rest] = rounds.value;
    if (!current) return;
    rounds.value = [patch(current), ...rest];
  }

  function settle(attempts: ConnectionAttempt[], url: string, outcome: AttemptOutcome, reason?: string): ConnectionAttempt[] {
    return attempts.map((attempt) =>
      attempt.url === url && attempt.outcome === 'pending' ? { ...attempt, outcome, reason, durationMs: now() - attempt.startedAt } : attempt,
    );
  }

  function settleRemaining(attempts: ConnectionAttempt[], outcome: AttemptOutcome, reason?: string): ConnectionAttempt[] {
    return attempts.map((attempt) => (attempt.outcome === 'pending' ? { ...attempt, outcome, reason, durationMs: now() - attempt.startedAt } : attempt));
  }

  return {
    rounds,

    roundStarted(): void {
      rounds.value = [{ startedAt: now(), attempts: [] }, ...rounds.value].slice(0, MAX_ROUNDS);
    },

    probeStarted(url, mode): void {
      if (rounds.value.length === 0) this.roundStarted();
      updateCurrent((round) => ({ ...round, attempts: [...round.attempts, { url, mode, startedAt: now(), outcome: 'pending' }] }));
    },

    probeSucceeded(url): void {
      updateCurrent((round) => ({ ...round, result: 'connected', attempts: settle(round.attempts, url, 'connected') }));
    },

    probeFailed(url, reason): void {
      updateCurrent((round) => {
        const outcome = round.result === 'connected' || reason.includes('superseded') ? 'superseded' : 'failed';
        return { ...round, attempts: settle(round.attempts, url, outcome, reason) };
      });
    },

    roundFailed(reason): void {
      updateCurrent((round) => ({ ...round, result: 'failed', reason, attempts: settleRemaining(round.attempts, 'failed', reason) }));
    },

    clear(): void {
      rounds.value = [];
    },
  };
}
