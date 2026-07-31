<template>
  <div>
    <video ref="videoPlayerRef" controls class="max-w-full max-h-[60vh] w-auto mx-auto">Your browser does not support the video tag.</video>
  </div>
</template>

<script setup lang="ts">
import type { PluginMotionInterfaceProps } from './types.js';

const props = defineProps<PluginMotionInterfaceProps>();

const { response } = toRefs(props);
const videoPlayerRef = useTemplateRef('videoPlayerRef');

onMounted(() => {
  if (videoPlayerRef.value) {
    const blob = new Blob([response.value.videoData as any], { type: 'video/mp4' });
    videoPlayerRef.value.src = URL.createObjectURL(blob);
    videoPlayerRef.value.load();
  }
});
</script>

<style scoped></style>
