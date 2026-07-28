<template>
  <div class="flex flex-col gap-2 w-full">
    <label for="workerName" class="cui-label">{{ $t('views.workers.name') }}</label>
    <InputText id="workerName" v-model="name" class="w-full" autofocus />
  </div>
</template>

<script setup lang="ts">
import type { CustomDialogComponent } from '@/composables/useCuiDialog.js';
import type { RenameWorkerProps } from './types.js';

const props = defineProps<RenameWorkerProps>();

const name = ref(props.currentName);

defineExpose<CustomDialogComponent>({
  onConfirm: async () => {
    const trimmed = name.value.trim();
    if (!trimmed) return null;
    return trimmed;
  },
});
</script>
