<template>
  <div class="flex flex-col gap-4 min-w-0">
    <video
      v-if="videoSrc && !videoFailed"
      :src="videoSrc"
      :poster="src"
      class="max-w-full max-h-[55vh] w-auto self-center rounded-lg"
      controls
      autoplay
      muted
      playsinline
      @click.stop
      @error="videoFailed = true"
    />
    <img v-else-if="src && !imageFailed" :src alt="" class="max-w-full max-h-[55vh] w-auto self-center rounded-lg" @error="imageFailed = true" />
    <span class="text-wrap whitespace-pre-line">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import type { NotificationDetailProps } from './types.js';

defineProps<NotificationDetailProps>();

const imageFailed = ref(false);
const videoFailed = ref(false);
</script>
