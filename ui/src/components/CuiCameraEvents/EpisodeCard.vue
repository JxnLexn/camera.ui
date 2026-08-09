<template>
  <div ref="cardRef" class="camera-event-card relative group cursor-pointer" @click="openEpisode">
    <div class="bg-neutral-900 w-[140px] h-[140px] rounded-xl overflow-hidden relative">
      <Skeleton v-if="mosaicState === 'loading'" class="w-full h-full rounded-xl" width="140px" height="140px" />

      <CuiImage
        v-else-if="mosaicUrl"
        :src="mosaicUrl"
        :alt="episode.description?.title"
        class="pointer-events-none w-full h-full transition-transform duration-300 group-hover:scale-105"
        :image-style="{ objectFit: 'cover' }"
        width="140px"
        height="140px"
        image-container-class="w-full h-full"
      />

      <div v-else class="w-full h-full flex items-center justify-center bg-neutral-800/80">
        <i-tabler:route class="w-8 h-8 text-white/20" />
      </div>

      <div
        class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex flex-col items-center justify-end pb-2 gap-1 z-[2] pointer-events-none"
      >
        <span class="text-xs text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 line-clamp-2 max-w-[130px] px-1 text-center">
          {{ episode.description?.title }}
        </span>
      </div>

      <div class="absolute top-1.5 right-1.5 z-[4] px-1.5 py-1 rounded-full bg-black/40 flex items-center gap-1">
        <i-tabler:sparkles class="w-3 h-3 text-white drop-shadow" />
        <span class="text-[10px] text-white font-medium leading-none">{{ cameraCount }}</span>
      </div>
    </div>

    <div class="mt-2 text-center">
      <p class="text-xs text-muted">{{ formatTime }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { thumbnailToUrl, useEventStore } from '@camera.ui/nvr';

import EpisodePlayerDialog from '@/components/CuiDialog/templates/EpisodePlayer/EpisodePlayer.vue';

import type { EpisodePlayerProps } from '@/components/CuiDialog/templates/EpisodePlayer/types.js';
import type { RecordedEpisode } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions';

const props = defineProps<{
  episode: RecordedEpisode;
  cameraById: Map<string, DBCamera>;
  clickDisabled?: boolean;
}>();

const dialog = useCuiDialog();
const eventStore = useEventStore('@camera.ui/camera-ui-nvr');

const cardRef = useTemplateRef('cardRef');
const mosaicUrl = ref<string | undefined>(undefined);
const mosaicState = ref<'loading' | 'loaded' | 'empty'>('loading');

let dialogInstance: DynamicDialogInstance | undefined;
let loadTriggered = false;

const cameraCount = computed(() => new Set(props.episode.members.map((m) => m.cameraId)).size);

const formatTime = computed(() => {
  const date = new Date(props.episode.startTime);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

async function triggerLoad(): Promise<void> {
  const mosaic = await eventStore.loadEpisodeMosaic(props.episode.id);
  if (mosaic) {
    mosaicUrl.value = thumbnailToUrl(mosaic);
    mosaicState.value = 'loaded';
    return;
  }
  mosaicState.value = 'empty';
}

function openEpisode(): void {
  if (props.clickDisabled) return;
  const first = props.episode.members[0];
  const camera = first ? props.cameraById.get(first.cameraId) : undefined;
  if (!camera) return;

  dialogInstance = dialog.openComponentDialog<EpisodePlayerProps>(EpisodePlayerDialog, {
    data: {
      title: props.episode.description?.title ?? camera.name,
      stayActive: true,
      hideCancelButton: true,
      hideConfirmButton: true,
      contentProps: {
        episode: props.episode,
        cameraById: props.cameraById,
      },
      draggable: true,
      blockDragOnSelectors: ['.p-dialog-body'],
      dismissableMask: false,
      modal: false,
      dialogContentClass: '!px-0 h-full',
      goTo: `/cameras/${camera.name}?startTs=${props.episode.startTime}`,
    },
    dialogSize: {
      desktop: {
        maxWidth: '900px',
        maxHeight: 'calc(100vh - max(1rem, env(safe-area-inset-top, 0px)) - max(1rem, env(safe-area-inset-bottom, 0px)))',
        width: '60vw',
      },
    },
  });
}

const { stop: stopObserver } = useIntersectionObserver(
  cardRef,
  ([entry]) => {
    if (entry.isIntersecting && !loadTriggered) {
      loadTriggered = true;
      stopObserver();
      triggerLoad();
    }
  },
  { threshold: 0.1 },
);

onUnmounted(() => {
  stopObserver();
  dialogInstance?.close();
});
</script>

<style scoped>
.camera-event-card {
  contain: layout;
}
</style>
