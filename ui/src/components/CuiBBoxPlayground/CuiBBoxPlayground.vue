<template>
  <div ref="containerRef" class="bbox-container min-w-0">
    <template v-for="(detection, i) in activeDetections" :key="'trackId' in detection ? `t${detection.trackId}` : i">
      <div
        class="bbox-corners"
        :class="{ tracked: 'trackId' in detection, stationary: isStationary(detection) }"
        :style="{
          left: `${getScaledX(detection.box.x)}px`,
          top: `${getScaledY(detection.box.y)}px`,
          width: `${getScaledWidth(detection.box.width)}px`,
          height: `${getScaledHeight(detection.box.height)}px`,
        }"
      >
        <div
          class="w-full h-full"
          :style="{
            background: highlightArea && !isStationary(detection) ? resolveHighlightStyle(resolveStyleKey(detection)).color : undefined,
          }"
        >
          <div
            v-for="corner in ['tl', 'tr', 'bl', 'br']"
            :key="corner"
            class="corner-lines"
            :class="corner"
            :style="{
              '--corner-color': resolveStyle(resolveStyleKey(detection)).color,
              '--corner-size': `${getCornerSize(detection)}px`,
            }"
          >
            <div class="line horizontal" />
            <div class="line vertical" />
          </div>
        </div>

        <div
          v-if="showLabel || showConfidence || showIcon"
          class="label z-1"
          :class="{
            'label-bottom': labelPlacement(detection) === 'below',
            'label-inside': labelPlacement(detection) === 'inside',
            'label-right': isLabelOnRight(detection),
          }"
          :style="{
            backgroundColor: isStationary(detection) ? `${resolveStyle(resolveStyleKey(detection)).color}B3` : resolveStyle(resolveStyleKey(detection)).color,
            fontSize: `${12 * labelScaleFactor}px`,
            padding: `${4 * labelScaleFactor}px ${8 * labelScaleFactor}px`,
            gap: `${4 * labelScaleFactor}px`,
            maxWidth: `${labelMaxWidth(detection)}px`,
          }"
        >
          <component :is="resolveStyle(resolveStyleKey(detection)).icon" v-if="showIcon" />
          <span v-if="showLabel && minDimension > 250" class="label-text"
            >{{ getDisplayLabel(detection) }}{{ 'trackId' in detection ? `#${detection.trackId}` : '' }}</span
          >
          <span v-if="showConfidence && minDimension > 250" class="confidence" :style="{ fontSize: `${11 * labelScaleFactor}px` }">
            {{ (detection.confidence * 100).toFixed(1) }}%
          </span>
          <span v-if="isStationary(detection) && minDimension > 250" class="dwell" :style="{ fontSize: `${11 * labelScaleFactor}px` }">
            <TimerIcon class="dwell-icon" />
            {{ formatDwell(detection) }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import PersonIcon from '~icons/bi/person-fill';
import AnimalIcon from '~icons/fluent/animal-paw-print-24-filled';
import VehicleIcon from '~icons/fluent/vehicle-car-16-filled';
import MotionIcon from '~icons/healthicons/running-24px';
import BoxesIcon from '~icons/lucide/boxes';
import LicensePlateIcon from '~icons/mdi/card-text-outline';
import FaceIcon from '~icons/mdi/face-recognition';
import ClassifierIcon from '~icons/mdi/tag-multiple';
import TimerIcon from '~icons/mdi/timer-outline';

import type { ClassifierDetection, FaceDetection, LicensePlateDetection, TrackedDetection } from '@camera.ui/sdk';
import type { AnyDetection, CuiBBoxPlaygroundProps } from './types.js';

const props = withDefaults(defineProps<CuiBBoxPlaygroundProps>(), {
  showConfidence: true,
  showIcon: true,
  showLabel: true,
  highlightArea: true,
  classes() {
    return [];
  },
  detections() {
    return [];
  },
});

const { detections, classes } = toRefs(props);

const typeStyles: Record<string, { color: string; icon: any }> = {
  motion: {
    color: '#A855F7',
    icon: MotionIcon,
  },
  animal: {
    color: '#22C55E',
    icon: AnimalIcon,
  },
  person: {
    color: '#3B82F6',
    icon: PersonIcon,
  },
  vehicle: {
    color: '#EF4444',
    icon: VehicleIcon,
  },
  face: {
    color: '#F59E0B',
    icon: FaceIcon,
  },
  license_plate: {
    color: '#06B6D4',
    icon: LicensePlateIcon,
  },
  classifier: {
    color: '#8B5CF6',
    icon: ClassifierIcon,
  },
  other: {
    color: '#CAC443',
    icon: BoxesIcon,
  },
};

const highlightStyles: Record<string, { color: string }> = {
  motion: {
    color: 'rgba(168, 85, 247, 0.1)',
  },
  animal: {
    color: 'rgba(34, 197, 94, 0.1)',
  },
  person: {
    color: 'rgba(59, 130, 246, 0.1)',
  },
  vehicle: {
    color: 'rgba(239, 68, 68, 0.1)',
  },
  face: {
    color: 'rgba(245, 158, 11, 0.1)',
  },
  license_plate: {
    color: 'rgba(6, 182, 212, 0.1)',
  },
  classifier: {
    color: 'rgba(139, 92, 246, 0.1)',
  },
  other: {
    color: 'rgba(202, 196, 67, 0.1)',
  },
};

const sources = new Map<string, AnyDetection[]>();

const containerRef = useTemplateRef('containerRef');
const activeDetections = shallowRef<AnyDetection[]>([]);
const now = ref(Date.now());

let dwellTimer: ReturnType<typeof setInterval> | undefined;

const { width: containerWidth, height: containerHeight } = useElementSize(containerRef);

const minDimension = computed(() => Math.min(containerWidth.value || 800, containerHeight.value || 600));

const labelScaleFactor = computed(() => {
  if (minDimension.value < 200) return 0.8;
  return 1;
});

// Box coordinates are relative (0-1), so we just multiply by container dimensions.
const getScaledX = computed(() => (x: number): number => {
  if (!containerWidth.value) return 0;
  return Math.round(x * containerWidth.value);
});

const getScaledY = computed(() => (y: number): number => {
  if (!containerHeight.value) return 0;
  return Math.round(y * containerHeight.value);
});

const getScaledWidth = computed(() => (w: number): number => {
  if (!containerWidth.value) return 0;
  return Math.round(w * containerWidth.value);
});

const getScaledHeight = computed(() => (h: number): number => {
  if (!containerHeight.value) return 0;
  return Math.round(h * containerHeight.value);
});

const getCornerSize = computed(() => (detection: AnyDetection): number => {
  const width = getScaledWidth.value(detection.box.width);
  const height = getScaledHeight.value(detection.box.height);
  const ratio = width < 200 ? 0.3 : width < 400 ? 0.25 : 0.2;
  return Math.min(width, height) * ratio;
});

const labelPlacement = computed(() => (detection: AnyDetection): 'above' | 'below' | 'inside' => {
  const minLabelSpace = 30 * labelScaleFactor.value;
  const topY = getScaledY.value(detection.box.y);
  if (topY >= minLabelSpace) return 'above';
  const bottomY = topY + getScaledHeight.value(detection.box.height);
  if (containerHeight.value - bottomY >= minLabelSpace) return 'below';
  return 'inside';
});

const isLabelOnRight = computed(() => (detection: AnyDetection): boolean => {
  const boxLeft = getScaledX.value(detection.box.x);
  return boxLeft > containerWidth.value * 0.7;
});

const labelMaxWidth = computed(() => (detection: AnyDetection): number => {
  const boxLeft = getScaledX.value(detection.box.x);
  if (isLabelOnRight.value(detection)) {
    return Math.max(40, boxLeft + getScaledWidth.value(detection.box.width) - 4);
  }
  return Math.max(40, containerWidth.value - boxLeft - 4);
});

function syncDwellTimer(): void {
  const hasStationary = activeDetections.value.some((d) => isStationary(d));
  if (hasStationary && dwellTimer === undefined) {
    dwellTimer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  } else if (!hasStationary && dwellTimer !== undefined) {
    clearInterval(dwellTimer);
    dwellTimer = undefined;
  }
}

function isStationary(detection: AnyDetection): detection is TrackedDetection & { stationarySince: number } {
  return 'stationarySince' in detection && typeof detection.stationarySince === 'number';
}

function formatDwell(detection: TrackedDetection & { stationarySince: number }): string {
  const seconds = Math.max(0, Math.floor((now.value - detection.stationarySince) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function isFaceDetection(d: AnyDetection): d is FaceDetection {
  return d.attribute === 'face';
}

function isLicensePlateDetection(d: AnyDetection): d is LicensePlateDetection {
  return d.attribute === 'license_plate';
}

function isClassifierDetection(d: AnyDetection): d is ClassifierDetection {
  return d.attribute !== 'face' && d.attribute !== 'license_plate' && 'subAttribute' in d;
}

function resolveStyleKey(detection: AnyDetection): string {
  if (isFaceDetection(detection)) return 'face';
  if (isLicensePlateDetection(detection)) return 'license_plate';
  if (isClassifierDetection(detection)) return 'classifier';
  return detection.label;
}

function resolveStyle(label: string) {
  return typeStyles[label] ?? typeStyles.other;
}

function resolveHighlightStyle(label: string) {
  return highlightStyles[label] ?? highlightStyles.other;
}

function getDisplayLabel(detection: AnyDetection): string {
  if (isLicensePlateDetection(detection)) {
    return detection.plateText || 'license plate';
  }
  if (isFaceDetection(detection)) {
    return detection.identity || 'face';
  }
  if (isClassifierDetection(detection)) {
    return detection.subAttribute || detection.label;
  }
  return detection.label;
}

function mergeDetections(): void {
  const all = [...sources.values()].flat();
  activeDetections.value = classes.value.length === 0 ? all : all.filter((d) => classes.value.includes(d.label));
  syncDwellTimer();
}

function draw(source: string, detections: AnyDetection[]): void {
  if (detections.length > 0) {
    sources.set(source, detections);
  } else {
    sources.delete(source);
  }
  mergeDetections();
}

function clear(source?: string): void {
  if (source) {
    sources.delete(source);
    mergeDetections();
  } else {
    sources.clear();
    activeDetections.value = [];
    syncDwellTimer();
  }
}

watch(
  detections,
  (newDetections) => {
    if (newDetections.length) {
      draw('props', newDetections);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (dwellTimer !== undefined) clearInterval(dwellTimer);
});

defineExpose({
  draw,
  clear,
});
</script>

<style scoped>
.bbox-container {
  position: absolute;
  top: 2.2px;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.bbox-corners {
  position: absolute;
  pointer-events: none;
}

.bbox-corners.tracked {
  transition:
    left 100ms linear,
    top 100ms linear,
    width 100ms linear,
    height 100ms linear;
}

.bbox-corners.stationary .corner-lines {
  opacity: 0.5;
}

.corner-lines {
  position: absolute;
  width: var(--corner-size);
  height: var(--corner-size);
}

.corner-lines .line {
  position: absolute;
  background-color: var(--corner-color);
}

.line.horizontal {
  height: 2px;
  width: 100%;
}

.line.vertical {
  width: 2px;
  height: 100%;
}

/* Corner Positions */
.corner-lines.tl {
  top: 0;
  left: 0;
}

.corner-lines.tr {
  top: 0;
  right: 0;
  transform: scaleX(-1);
}

.corner-lines.bl {
  bottom: 0;
  left: 0;
  transform: scaleY(-1);
}

.corner-lines.br {
  bottom: 0;
  right: 0;
  transform: scale(-1);
}

.label {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  color: white;
  font-weight: bold;
  white-space: nowrap;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  border-bottom-right-radius: 6px;
  border-bottom-left-radius: 0;
  transform: translateY(-100%);
  transition: all 0.2s ease-in-out;
}

.label.label-bottom {
  top: calc(100% - 2.2px);
  transform: translateY(0);
  border-radius: 0;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  border-top-right-radius: 6px;
  border-top-left-radius: 0;
}

.label.label-right {
  left: auto;
  right: 0;
  flex-direction: row-reverse;
  border-top-left-radius: 6px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 6px;
}

.label.label-right.label-bottom {
  border-top-left-radius: 6px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 6px;
}

.label.label-inside {
  top: 2px;
  left: 2px;
  transform: translateY(0);
  border-radius: 6px;
}

.label.label-inside.label-right {
  left: auto;
  right: 2px;
}

.label-text {
  margin-right: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.label.label-right .label-text {
  margin-right: 0;
  margin-left: 4px;
}

.confidence {
  opacity: 0.9;
}

.dwell {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  opacity: 0.9;
}

.dwell-icon {
  width: 1em;
  height: 1em;
}
</style>
