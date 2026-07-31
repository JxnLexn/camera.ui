<template>
  <div class="mb-5 flex justify-center">
    <!-- the bbox overlay sizes itself to this box, it must match the image exactly -->
    <div class="relative w-fit">
      <CuiBBoxPlayground :detections />
      <img :src alt="Preview" class="max-w-full max-h-[60vh] w-auto" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AnyDetection } from '@/components/CuiBBoxPlayground/types.js';
import type { PluginObjectInterfaceProps } from './types.js';

const props = defineProps<PluginObjectInterfaceProps>();

const { response, src } = toRefs(props);

const detections = computed<AnyDetection[]>(() => {
  return response.value.detections;
});
</script>

<style scoped></style>
