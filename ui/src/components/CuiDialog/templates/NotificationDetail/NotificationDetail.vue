<template>
  <div class="flex flex-col gap-4 min-w-0">
    <img v-if="!imageFailed" :src alt="" class="max-w-full max-h-[55vh] w-auto self-center rounded-lg" @error="imageFailed = true" />
    <span class="text-wrap whitespace-pre-line">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import type { NotificationDetailProps } from './types.js';

defineProps<NotificationDetailProps>();

const imageFailed = ref(false);
</script>
