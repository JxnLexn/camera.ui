<template>
  <div class="episode-player-container">
    <div ref="stageRef" class="relative w-full overflow-hidden bg-black" :style="{ aspectRatio: stageAspect }">
      <div v-for="id in memberCameraIds" v-show="id === visibleCameraId" :key="id" :ref="(el) => setStageEl(id, el as HTMLElement | null)" class="absolute inset-0" />

      <div class="absolute inset-0 z-[3] bg-black pointer-events-none transition-opacity duration-300" :class="transitioning ? 'opacity-100' : 'opacity-0'" />

      <div v-if="showSpinner || transitioning" class="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
        <ProgressSpinner class="w-[30px] h-[30px] m-0" stroke-width="5" />
      </div>

      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-300"
        leave-to-class="opacity-0"
      >
        <div v-if="skipNoticeSec > 0" class="absolute inset-0 z-[4] flex items-center justify-center pointer-events-none">
          <span class="px-3 py-1.5 rounded-full bg-black/70 text-white text-sm font-medium tabular-nums">+{{ skipNoticeSec }}s</span>
        </div>
      </Transition>

      <div class="absolute top-0 left-0 right-0 p-3 z-[3] flex items-center gap-2 pointer-events-none">
        <span class="text-sm font-semibold p-2 bg-black/60 rounded-xl text-white truncate">{{ activeCameraName }}</span>
        <span class="ml-auto text-sm font-medium p-2 bg-black/60 rounded-xl text-white tabular-nums shrink-0">{{ clockLabel }}</span>
      </div>

      <Transition name="fade-2">
        <div v-if="showControl" class="absolute bottom-0 inset-x-0 z-[5] dark-mode">
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div class="relative flex items-center gap-1 px-3 pb-2 pt-6">
            <div class="flex items-center gap-0.5">
              <Button fluid text severity="contrast" @click="jumpBlock(-1)">
                <template #icon>
                  <i-mdi:skip-previous class="w-[18px] h-[18px]" />
                </template>
              </Button>
              <Button fluid text severity="contrast" @click="togglePlay">
                <template #icon>
                  <i-basil:pause-solid v-if="isPlaying" class="w-[18px] h-[18px]" />
                  <i-basil:play-solid v-else class="w-[18px] h-[18px]" />
                </template>
              </Button>
              <Button fluid text severity="contrast" @click="jumpBlock(1)">
                <template #icon>
                  <i-mdi:skip-next class="w-[18px] h-[18px]" />
                </template>
              </Button>
            </div>

            <div class="flex-1" />

            <Button fluid text severity="contrast" @click="muted = !muted">
              <template #icon>
                <i-heroicons:speaker-wave-16-solid v-if="!muted" class="w-[18px] h-[18px]" />
                <i-heroicons:speaker-x-mark-16-solid v-else class="w-[18px] h-[18px]" />
              </template>
            </Button>
          </div>
        </div>
      </Transition>
    </div>

    <div class="px-3 pt-3 pb-2">
      <div
        ref="stripRef"
        class="relative h-[36px] rounded-lg bg-white/5 cursor-pointer select-none touch-none"
        @pointerdown="onStripPointerDown"
        @pointermove="onStripPointerMove"
        @pointerup="onStripPointerUp"
        @pointercancel="onStripPointerUp"
      >
        <div
          v-for="(block, i) in cameraBlocks"
          :key="i"
          class="absolute top-[3px] bottom-[3px] rounded-[4px] flex items-center justify-center overflow-hidden pointer-events-none"
          :class="isActiveBlock(block) ? 'bg-primary-500/60' : 'bg-primary-500/25'"
          :style="blockStyle(block)"
        >
          <span class="text-[10px] font-medium text-white/90 truncate px-1.5">{{ cameraName(block.cameraId) }}</span>
        </div>
        <div class="absolute top-0 bottom-0 w-[2px] bg-white z-[2] pointer-events-none rounded-full" :style="{ left: playheadPct }" />
      </div>
      <div class="flex justify-between mt-1 text-[10px] text-muted tabular-nums">
        <span>{{ boundLabel(rangeStartMs) }}</span>
        <span>{{ boundLabel(rangeEndMs) }}</span>
      </div>
    </div>

    <div v-if="episode.description?.description" class="px-4 pb-3 flex gap-2 items-start">
      <i-tabler:sparkles class="w-4 h-4 shrink-0 mt-0.5 text-color" />
      <p class="text-xs text-muted">{{ episode.description.description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { playheadUs, useMultiNvrPlayback } from '@camera.ui/nvr';
import DownloadIcon from '~icons/tabler/download';

import { extractErrorMessage } from '@/common/utils.js';

import type { DialogRefProps } from '@/composables/useCuiDialog.js';
import type { EpisodeMember } from '@camera.ui/nvr';
import type { EpisodePlayerProps } from './types.js';

interface StripBlock {
  cameraId: string;
  startMs: number;
  endMs: number;
}

const props = defineProps<EpisodePlayerProps>();

const log = useLogger();
const toast = useCuiToast();
const { t } = useI18n();
const dialogRefProps = inject<DialogRefProps>('dialogRefProps')!;
const { plugin: nvrPluginRef } = usePlugin('@camera.ui/camera-ui-nvr');

const PREROLL_MS = 5000;
const GAP_SKIP_MIN_MS = 2000;
const BLOCK_TAIL_MS = 2000;
const BLOCK_HEAD_MS = 6000;
const PRELOAD_AHEAD_MS = 8000;
const HANDOFF_WAIT_MS = 1200;
const TRANSITION_MAX_MS = 1500;

const rangeStartMs = props.episode.startTime - PREROLL_MS;
const rangeEndMs = props.episode.endTime;
const rangeMs = Math.max(rangeEndMs - rangeStartMs, 1);

const members: EpisodeMember[] = [...props.episode.members].sort((a, b) => a.firstSeen - b.firstSeen);
const memberCameraIds = [...new Set(members.map((m) => m.cameraId))];
const cameraBlocks = buildCameraBlocks();

const stageRef = useTemplateRef('stageRef');
const stripRef = useTemplateRef('stripRef');
const playheadMs = ref(rangeStartMs);
const activeCameraId = ref(cameraAt(rangeStartMs));
const visibleCameraId = ref(activeCameraId.value);
const muted = ref(true);
const ended = ref(false);
const scrubbing = ref(false);
const skipNoticeSec = ref(0);

const isDownloading = ref(false);
const initialHover = ref(true);
const transitioning = ref(false);

const isHovered = useElementHover(stageRef, { delayLeave: 1000 });

const stageEls = new Map<string, HTMLElement>();
const claimReleases: (() => void)[] = [];
let playbackStarted = false;
let wasPlayingBeforeScrub = false;
let lastScrubSent = 0;
let lastSkipAt = 0;
let handoffStartedAt = 0;
let transitionStartedAt = 0;
let skipNoticeTimer: ReturnType<typeof setTimeout> | undefined;

const preloadCameraId = computed(() => {
  const next = cameraBlocks.find((b) => b.startMs > playheadMs.value && b.cameraId !== activeCameraId.value && b.startMs - playheadMs.value <= PRELOAD_AHEAD_MS);
  return next?.cameraId;
});

const activeIds = computed(() => {
  const ids = new Set([activeCameraId.value, visibleCameraId.value]);
  if (preloadCameraId.value) ids.add(preloadCameraId.value);
  return [...ids];
});

const { master, controllers } = useMultiNvrPlayback(ref(memberCameraIds), { activeIds });

const isPlaying = computed(() => master.mode.value === 'play');
const showControl = computed(() => isHovered.value || initialHover.value);
const showSpinner = computed(() => !scrubbing.value && (master.loading.value || master.mode.value === 'idle'));

const stageAspect = computed(() => {
  return props.cameraById.get(visibleCameraId.value)?.interfaceSettings.aspectRatio.replace(':', '/') ?? '16/9';
});

const activeCameraName = computed(() => cameraName(visibleCameraId.value));

const clockLabel = computed(() => {
  return new Date(playheadMs.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
});

const playheadPct = computed(() => `${((playheadMs.value - rangeStartMs) / rangeMs) * 100}%`);

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function cameraName(id: string): string {
  return props.cameraById.get(id)?.name ?? id;
}

function coveringMemberAt(tMs: number): EpisodeMember | undefined {
  let best: EpisodeMember | undefined;
  for (const m of members) {
    if (m.firstSeen <= tMs && tMs <= m.lastSeen && (!best || m.firstSeen >= best.firstSeen)) best = m;
  }
  return best;
}

function cameraAt(tMs: number): string {
  for (const block of cameraBlocks) {
    if (tMs < block.endMs) return block.cameraId;
  }
  return cameraBlocks[cameraBlocks.length - 1]?.cameraId ?? '';
}

function grayUntil(tMs: number): number | undefined {
  for (let i = 0; i < cameraBlocks.length - 1; i++) {
    if (tMs >= cameraBlocks[i].endMs && tMs < cameraBlocks[i + 1].startMs) return cameraBlocks[i + 1].startMs;
  }
  return undefined;
}

function buildCameraBlocks(): StripBlock[] {
  const cuts = new Set<number>([rangeStartMs, rangeEndMs]);
  for (const m of members) {
    cuts.add(clamp(m.firstSeen, rangeStartMs, rangeEndMs));
    cuts.add(clamp(m.lastSeen, rangeStartMs, rangeEndMs));
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  const blocks: StripBlock[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const startMs = sorted[i];
    const endMs = sorted[i + 1];
    if (endMs - startMs < 1) continue;
    const covering = coveringMemberAt((startMs + endMs) / 2);
    if (!covering) continue;
    const prev = blocks[blocks.length - 1];
    if (prev && prev.cameraId === covering.cameraId && prev.endMs >= startMs) prev.endMs = endMs;
    else blocks.push({ cameraId: covering.cameraId, startMs, endMs });
  }

  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i];
    const next = blocks[i + 1];
    const gap = next.startMs - cur.endMs;
    if (gap <= 0) continue;
    const tail = Math.min(BLOCK_TAIL_MS, Math.floor(gap / 2));
    cur.endMs += tail;
    next.startMs -= Math.min(BLOCK_HEAD_MS, gap - tail);
  }
  if (blocks.length > 0) {
    blocks[0].startMs = rangeStartMs;
    blocks[blocks.length - 1].endMs = rangeEndMs;
  }
  return blocks;
}

function isActiveBlock(block: StripBlock): boolean {
  return block.startMs <= playheadMs.value && playheadMs.value < block.endMs;
}

function blockStyle(block: StripBlock): Record<string, string> {
  const left = ((block.startMs - rangeStartMs) / rangeMs) * 100;
  const width = ((block.endMs - block.startMs) / rangeMs) * 100;
  // short spans stay a visible chip instead of a hairline
  return { left: `calc(${left}% + 1px)`, width: `max(calc(${width}% - 2px), 14px)` };
}

function boundLabel(tMs: number): string {
  return new Date(tMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function setStageEl(id: string, el: HTMLElement | null): void {
  if (el) stageEls.set(id, el);
  else stageEls.delete(id);
}

function setPlayhead(tMs: number): void {
  playheadMs.value = clamp(tMs, rangeStartMs, rangeEndMs);
  activeCameraId.value = cameraAt(playheadMs.value);
}

function ctrlReady(id: string): boolean {
  const ctrl = controllers.value.get(id);
  if (!ctrl) return true;
  const tsMs = ctrl.currentTimestamp.value / 1000;
  return !ctrl.loading.value && tsMs > 0 && Math.abs(tsMs - playheadMs.value) < 6000;
}

function beginHandoffTransition(): void {
  transitioning.value = true;
  transitionStartedAt = performance.now();
}

function trySyncVisibleCamera(): void {
  const target = activeCameraId.value;
  if (visibleCameraId.value !== target) {
    if (!ctrlReady(target) && performance.now() - handoffStartedAt <= HANDOFF_WAIT_MS) return;
    visibleCameraId.value = target;
  }
  if (transitioning.value && (ctrlReady(visibleCameraId.value) || performance.now() - transitionStartedAt > TRANSITION_MAX_MS)) {
    transitioning.value = false;
  }
}

function seekTo(tMs: number, forcePlay = false): void {
  setPlayhead(tMs);
  ended.value = false;
  if (forcePlay || master.mode.value === 'play') {
    master.play(playheadMs.value * 1000);
  } else {
    master.scrub(playheadMs.value * 1000, true);
  }
}

function togglePlay(): void {
  const mode = master.mode.value;
  if (mode === 'play') {
    master.pause();
    return;
  }
  if (ended.value) {
    seekTo(rangeStartMs, true);
    return;
  }
  if (mode === 'pause') {
    master.resume();
    return;
  }
  seekTo(playheadMs.value, true);
}

function jumpBlock(dir: 1 | -1): void {
  const t = playheadMs.value;
  beginHandoffTransition();
  if (dir === 1) {
    const next = cameraBlocks.find((b) => b.startMs > t + 500);
    if (next) seekTo(next.startMs);
    return;
  }
  const prev = [...cameraBlocks].reverse().find((b) => b.startMs < t - 1500);
  seekTo(prev?.startMs ?? rangeStartMs);
}

function showSkipNotice(seconds: number): void {
  skipNoticeSec.value = seconds;
  if (skipNoticeTimer) clearTimeout(skipNoticeTimer);
  skipNoticeTimer = setTimeout(() => {
    skipNoticeSec.value = 0;
  }, 1400);
}

function stripTimeFromEvent(e: PointerEvent): number {
  const rect = stripRef.value!.getBoundingClientRect();
  const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
  return rangeStartMs + frac * rangeMs;
}

function onStripPointerDown(e: PointerEvent): void {
  if (!stripRef.value) return;
  stripRef.value.setPointerCapture(e.pointerId);
  scrubbing.value = true;
  wasPlayingBeforeScrub = master.mode.value === 'play';
  applyScrub(stripTimeFromEvent(e), true);
}

function onStripPointerMove(e: PointerEvent): void {
  if (!scrubbing.value) return;
  applyScrub(stripTimeFromEvent(e));
}

function onStripPointerUp(e: PointerEvent): void {
  if (!scrubbing.value) return;
  scrubbing.value = false;
  setPlayhead(stripTimeFromEvent(e));
  ended.value = false;
  if (wasPlayingBeforeScrub) master.play(playheadMs.value * 1000);
  else master.scrub(playheadMs.value * 1000, true);
}

function applyScrub(tMs: number, force = false): void {
  setPlayhead(tMs);
  const now = performance.now();
  if (!force && now - lastScrubSent < 120) return;
  lastScrubSent = now;
  master.scrub(playheadMs.value * 1000, true);
}

async function handleDownload(): Promise<void> {
  if (isDownloading.value) return;
  const nvrPlugin = nvrPluginRef.value as { nvrExportEpisode: (episodeID: string) => Promise<{ url: string; filename: string }> } | undefined;
  if (!nvrPlugin?.nvrExportEpisode) return;

  isDownloading.value = true;
  try {
    const result = await nvrPlugin.nvrExportEpisode(props.episode.id);
    await download({ url: result.url, filename: result.filename });
  } catch (error) {
    log.error('Episode download failed:', error);
    toast.add({ severity: 'error', summary: t('views.recordings.download_failed'), detail: extractErrorMessage(error), life: 5000 });
  } finally {
    isDownloading.value = false;
  }
}

function resolveGoTo(): string | undefined {
  const camera = props.cameraById.get(activeCameraId.value);
  if (!camera) return undefined;
  return `/cameras/${camera.name}?startTs=${Math.floor(playheadMs.value)}`;
}

watchEffect(() => {
  for (const [id, ctrl] of controllers.value) {
    ctrl.muted.value = muted.value || id !== visibleCameraId.value;
  }
});

watch(activeCameraId, (next) => {
  handoffStartedAt = performance.now();
  if (controllers.value.get(next)?.isActive.value) {
    visibleCameraId.value = next;
    return;
  }
  trySyncVisibleCamera();
});

watch(
  nvrPluginRef,
  (proxy) => {
    if (!proxy || playbackStarted) return;
    playbackStarted = true;
    master.play(rangeStartMs * 1000);
  },
  { immediate: true },
);

watch(
  [nvrPluginRef, isDownloading],
  ([proxy]) => {
    if (!dialogRefProps.headerActions) return;
    if (!proxy) {
      dialogRefProps.headerActions.value = [];
      return;
    }
    dialogRefProps.headerActions.value = [{ icon: DownloadIcon, tooltip: t('views.recordings.download'), onClick: handleDownload, loading: isDownloading.value }];
  },
  { immediate: true },
);

useIntervalFn(() => {
  trySyncVisibleCamera();
  if (scrubbing.value || master.mode.value === 'idle') return;
  const us = playheadUs(master);
  if (us <= 0) return;
  let tMs = us / 1000;

  if (master.mode.value === 'play') {
    if (tMs >= rangeEndMs) {
      master.pause();
      ended.value = true;
      setPlayhead(rangeEndMs);
      return;
    }
    const now = performance.now();
    if (now - lastSkipAt > 1500) {
      const targetMs = grayUntil(tMs);
      if (targetMs !== undefined && targetMs - tMs > GAP_SKIP_MIN_MS) {
        lastSkipAt = now;
        showSkipNotice(Math.round((targetMs - tMs) / 1000));
        beginHandoffTransition();
        master.seek(targetMs * 1000);
        tMs = targetMs;
      }
    }
  }
  setPlayhead(tMs);
}, 250);

onMounted(() => {
  for (const [id, ctrl] of controllers.value) {
    const el = stageEls.get(id);
    if (el) claimReleases.push(ctrl.claimContainer(el));
  }
  setTimeout(() => (initialHover.value = false), 1500);
});

onUnmounted(() => {
  if (skipNoticeTimer) clearTimeout(skipNoticeTimer);
  master.stop();
  for (const release of claimReleases) release();
});

defineExpose({
  resolveGoTo,
});
</script>

<style scoped>
.episode-player-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  contain: inline-size;
}
</style>
