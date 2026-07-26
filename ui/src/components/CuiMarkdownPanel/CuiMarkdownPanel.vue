<template>
  <div>
    <span class="lg:!hidden card-title">{{ title }}</span>
    <Card class="cui-card !h-auto lg:!h-full">
      <template #content>
        <div ref="frame" class="flex flex-col h-full">
          <div class="flex items-center gap-3 border-color lg:border-b-[1px] lg:mb-3 lg:pb-3">
            <h3 class="hidden lg:block text-base font-semibold">{{ title }}</h3>
            <Button
              v-if="canExpand"
              v-tooltip.left="{ value: expanded ? $t('components.form.button.collapse') : $t('components.form.button.expand') }"
              severity="secondary"
              text
              class="cui-button ml-auto p-1"
              @click="expanded = !expanded"
            >
              <template #icon>
                <i-eva:collapse-outline v-if="expanded" class="w-[18px] h-[18px]" />
                <i-eva:expand-outline v-else class="w-[18px] h-[18px]" />
              </template>
            </Button>
          </div>

          <div v-if="loading" class="flex w-full h-full items-center justify-center">
            <ProgressSpinner class="w-[30px] h-[30px] m-0" stroke-width="5" />
          </div>
          <div v-else ref="body" class="overflow-y-auto" :style="expanded ? undefined : { maxHeight: `${collapsedMax}px` }">
            <CuiMarkdownContent :content="content || placeholder" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { CUI_MARKDOWN_PANEL_DEFAULTS } from './types.js';

import type { CuiMarkdownPanelProps } from './types.js';

const props = withDefaults(defineProps<CuiMarkdownPanelProps>(), CUI_MARKDOWN_PANEL_DEFAULTS);

const frameRef = useTemplateRef<HTMLElement>('frame');
const bodyRef = useTemplateRef<HTMLElement>('body');

const expanded = ref(false);
const overflows = ref(false);
const collapsedMax = ref(props.collapsedHeight);

const canExpand = computed(() => !props.loading && (expanded.value || overflows.value));

function fit(): void {
  const frame = frameRef.value;
  const body = bodyRef.value;
  if (!frame || !body) return;

  const free = Math.round(frame.getBoundingClientRect().bottom - body.getBoundingClientRect().top);
  const next = Math.max(props.collapsedHeight, free);

  if (Math.abs(next - collapsedMax.value) > 2) collapsedMax.value = next;
}

function measure(): void {
  if (expanded.value) return;

  fit();

  const el = bodyRef.value;
  overflows.value = !!el && el.scrollHeight > el.clientHeight + 1;
}

useEventListener(bodyRef, 'load', measure, { capture: true });
useResizeObserver(frameRef, measure);
useResizeObserver(bodyRef, measure);

watch([() => props.content, () => props.loading], () => nextTick(measure));

onMounted(() => nextTick(measure));
</script>
