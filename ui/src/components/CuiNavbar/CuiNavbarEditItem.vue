<template>
  <div
    :ref="setRef"
    class="w-full h-[44px] flex items-center gap-3 rounded-lg cursor-grab select-none touch-none"
    :class="[isDragging ? 'opacity-30' : 'hover:bg-white/5', hidden ? '!opacity-40' : '']"
    :style="{ color: '#a4a4a4', paddingLeft: '14px', paddingRight: '10px' }"
  >
    <component :is="icon" v-if="icon" class="w-[22px] h-[22px] shrink-0" />
    <span v-if="expanded" class="text-sm truncate flex-1 text-left" :class="{ 'line-through': hidden }">{{ label }}</span>
    <Button v-if="hideable && expanded" text rounded severity="secondary" class="cui-icon-md shrink-0 !text-[#a4a4a4]" @click.stop="$emit('toggle-hidden')">
      <template #icon>
        <i-mdi:eye-off v-if="hidden" width="100%" height="100%" />
        <i-mdi:eye v-else width="100%" height="100%" />
      </template>
    </Button>
    <i-mdi:drag v-if="expanded" class="w-[18px] h-[18px] shrink-0 opacity-60" />
  </div>
</template>

<script setup lang="ts">
import { useDrag, useDrop } from 'vue3-dnd';

import { useDragAutoScroll } from './useDragAutoScroll.js';

import type { CuiNavbarEditItemEmits, CuiNavbarEditItemProps } from './types.js';

const props = defineProps<CuiNavbarEditItemProps>();

defineEmits<CuiNavbarEditItemEmits>();

const elRef = ref<HTMLElement | null>(null);

const [collect, drag] = useDrag(() => ({
  type: 'nav-item',
  item: () => ({ name: props.name }),
  collect: (monitor) => ({ isDragging: monitor.isDragging() }),
}));

const [, drop] = useDrop(() => ({
  accept: 'nav-item',
  hover({ name: draggedName }: { name: string }, monitor) {
    if (draggedName === props.name) return;
    const el = elRef.value;
    const over = props.findItem(props.name);
    const from = props.findItem(draggedName);
    if (!el || !over || !from) return;

    const rect = el.getBoundingClientRect();
    const clientOffset = monitor.getClientOffset();
    if (!clientOffset) return;
    const hoverY = clientOffset.y - rect.top;
    const middleY = rect.height / 2;

    if (from.group === over.group) {
      if (from.index < over.index && hoverY < middleY) return;
      if (from.index > over.index && hoverY > middleY) return;
      props.moveItem(draggedName, over.group, over.index);
      return;
    }

    props.moveItem(draggedName, over.group, hoverY > middleY ? over.index + 1 : over.index);
  },
}));

const isDragging = computed(() => collect.value.isDragging);

useDragAutoScroll(elRef, isDragging);

function setRef(el: any) {
  elRef.value = el;
  drag(drop(el));
}
</script>
