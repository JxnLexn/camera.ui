<template>
  <div class="flex items-center gap-2 min-h-[15px]">
    <span class="cui-label">{{ label }}</span>
    <ProgressSpinner v-if="loading" class="w-[12px] h-[12px] m-0" stroke-width="8" />
  </div>
</template>

<script lang="ts" setup>
defineProps<{ label: string; loading?: boolean }>();
</script>
