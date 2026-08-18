<template>
  <div class="flex flex-col gap-4">
    <template v-if="showProgress">
      <span class="text-sm text-pretty">{{ checking ? $t('views.recordings.reindex.checking') : $t('views.recordings.reindex.running_intro') }}</span>

      <div class="flex flex-col gap-2">
        <ProgressBar :mode="checking ? 'indeterminate' : 'determinate'" :value="progressPercent" :show-value="false" class="h-2" />
        <div v-if="!checking" class="flex justify-between text-sm text-muted">
          <span>{{ $t('views.recordings.reindex.progress', { done: status?.done ?? 0, total: status?.total ?? 0 }) }}</span>
          <span v-if="status?.skipped">{{ $t('views.recordings.reindex.skipped', { count: status.skipped }) }}</span>
        </div>
      </div>

      <div class="flex justify-end">
        <Button severity="danger" text :label="$t('views.recordings.reindex.stop')" :disabled="isBusy" @click="cancel" />
      </div>
    </template>

    <template v-else-if="finished">
      <span class="text-sm text-pretty">
        {{
          status?.total
            ? $t('views.recordings.reindex.result', { done: status.done, total: status.total, skipped: status.skipped })
            : $t('views.recordings.reindex.up_to_date')
        }}
      </span>
    </template>

    <template v-else>
      <span class="text-sm text-pretty">{{ $t('views.recordings.reindex.intro') }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useClipReindex } from '@camera.ui/nvr';

import type { CustomDialogComponent, DialogRefProps } from '@/composables/useCuiDialog.js';

const dialogRefProps = inject<DialogRefProps>('dialogRefProps')!;

const { status, isBusy, checking, refresh, start, cancel } = useClipReindex();

const started = ref(false);
const flashFull = ref(false);

const running = computed(() => status.value?.running === true);
const showProgress = computed(() => running.value || flashFull.value);
const finished = computed(() => started.value && !showProgress.value);

const progressPercent = computed(() => {
  if (flashFull.value) return 100;
  const total = status.value?.total ?? 0;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((((status.value?.done ?? 0) + (status.value?.skipped ?? 0)) / total) * 100));
});

async function onConfirm(): Promise<null> {
  started.value = true;
  start();
  return null;
}

watch(running, (now, was) => {
  if (was && !now && started.value && !status.value?.total) {
    flashFull.value = true;
    setTimeout(() => {
      flashFull.value = false;
    }, 700);
  }
});

watchEffect(() => {
  if (dialogRefProps.hideConfirmButton) dialogRefProps.hideConfirmButton.value = started.value || running.value;
});

onMounted(() => {
  refresh().then(() => {
    if (status.value?.running) started.value = true;
  });
});

defineExpose<CustomDialogComponent>({ onConfirm });
</script>
