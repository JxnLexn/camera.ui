<template>
  <div :ref="setRef" class="w-full flex items-center h-[26px] mb-1 rounded-lg transition-colors" :class="[{ 'mt-4': !first }, isOver ? 'bg-white/5' : '']">
    <span class="pl-[14px] text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap" :class="isOver ? 'text-primary-500' : 'text-[#7a7a7a]'">{{
      label
    }}</span>
  </div>
</template>

<script setup lang="ts">
import { useDrop } from 'vue3-dnd';

import type { CuiNavbarEditGroupLabelProps } from './types.js';

const props = defineProps<CuiNavbarEditGroupLabelProps>();

const [collect, drop] = useDrop(() => ({
  accept: 'nav-item',
  hover({ name }: { name: string }) {
    props.moveToEnd(name, props.group);
  },
  collect: (monitor) => ({ isOver: monitor.isOver() }),
}));

const isOver = computed(() => collect.value.isOver);

function setRef(el: any) {
  drop(el);
}
</script>
