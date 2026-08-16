<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col field-gap">
      <span class="section-chip">{{ $t('components.connection_details.current') }}</span>
      <span class="text-sm font-bold text-color">{{ targetLabel }}</span>
      <Message severity="secondary" variant="simple" size="small" class="cui-input-hint break-all">{{ targetUrl }}</Message>
    </div>

    <div class="flex flex-col field-gap">
      <span class="section-chip">{{ $t('components.connection_details.server_view') }}</span>
      <span class="text-sm text-color">{{ currentType }}</span>
      <Message severity="secondary" variant="simple" size="small" class="cui-input-hint break-all">{{ currentAddress }}</Message>
    </div>

    <div class="flex flex-col field-gap">
      <span class="section-chip">{{ $t('components.connection_details.last_attempt') }}</span>

      <p v-if="rows.length === 0" class="text-sm text-muted">{{ $t('components.connection_details.no_attempts') }}</p>

      <div v-else class="flex flex-col gap-2">
        <div v-for="row in rows" :key="row.url" class="flex items-start gap-3">
          <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="dotClass(row.outcome)" />
          <div class="flex flex-col min-w-0">
            <span class="text-sm text-color">
              {{ row.modeLabel }}
              <span class="text-muted">·</span>
              {{ formatDuration(row) }}
              <span class="text-muted">·</span>
              {{ outcomeLabel(row) }}
            </span>
            <span class="text-xs text-muted break-all">{{ row.url }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ApiQuery } from '@/api/routes/api.js';
import { copyToClipboard } from '@/common/utils.js';
import { getConnection, isConnectionBooted } from '@/connection/instance.js';

import type { AttemptOutcome } from '@/connection/attempts.js';
import type { AttemptRow, ConnectionDetailsProps } from './types.js';

const props = defineProps<ConnectionDetailsProps>();

const apiQuery = new ApiQuery();
const toast = useCuiToast();
const { t } = useI18n();

const { data: apiInfo } = apiQuery.apiInfoQuery();

const connection = isConnectionBooted() ? getConnection() : undefined;
const round = computed(() => connection?.attempts.rounds.value[0]);

const targetUrl = computed(() => connection?.target.value?.endpoint.url ?? t('components.connection_details.no_target'));
const targetLabel = computed(() => {
  const mode = connection?.target.value?.endpoint.mode;
  if (!mode) return t('components.connection_details.no_target');
  return mode === 'direct-lan' ? t('components.connection_details.mode_lan') : t('components.connection_details.mode_wan');
});

const rows = computed<AttemptRow[]>(
  () =>
    round.value?.attempts.map((attempt) => ({
      ...attempt,
      modeLabel: attempt.mode === 'direct-lan' ? t('components.connection_details.mode_lan') : t('components.connection_details.mode_wan'),
    })) ?? [],
);

function dotClass(outcome: AttemptOutcome): string {
  if (outcome === 'connected') return 'bg-green-500';
  if (outcome === 'failed') return 'bg-red-500';
  return 'bg-neutral-400';
}

function formatDuration(row: AttemptRow): string {
  if (row.durationMs === undefined) return '…';
  return row.durationMs >= 1000 ? `${(row.durationMs / 1000).toFixed(1)} s` : `${row.durationMs} ms`;
}

function outcomeLabel(row: AttemptRow): string {
  if (row.outcome === 'connected') return t('components.connection_details.outcome_connected');
  if (row.outcome === 'superseded') return t('components.connection_details.outcome_superseded');
  if (row.outcome === 'pending') return t('components.connection_details.outcome_pending');
  if (row.reason?.includes('timeout')) return t('components.connection_details.outcome_timeout');
  return row.reason ?? t('components.connection_details.outcome_failed');
}

async function onConfirm(): Promise<void | null> {
  const lines = [
    new Date().toISOString(),
    `camera.ui ${apiInfo.value?.version ?? '?'}`,
    '',
    `${targetLabel.value}: ${targetUrl.value}`,
    `server sees: ${props.currentType} ${props.currentAddress}`,
    '',
  ];
  for (const row of rows.value) {
    lines.push(`${row.outcome === 'connected' ? '+' : '-'} ${row.modeLabel} ${row.url} ${formatDuration(row)} ${outcomeLabel(row)}`);
  }
  if (round.value?.reason) lines.push('', round.value.reason);

  if (await copyToClipboard(lines.join('\n'))) {
    toast.add({ severity: 'success', detail: t('components.connection_details.copied'), life: 2000 });
    return;
  }

  toast.add({ severity: 'error', detail: t('components.connection_details.copy_failed'), life: 3000 });
  return null;
}

defineExpose({ onConfirm });
</script>
