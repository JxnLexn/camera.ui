<template>
  <div
    class="cui-binary-sensor"
    :class="[
      `cui-binary-sensor--${size}`,
      {
        'cui-binary-sensor--disabled': disabled,
        'cui-binary-sensor--clear': !detected,
        'cui-binary-sensor--detected': detected,
      },
    ]"
  >
    <div class="cui-binary-sensor__header">
      <div class="cui-binary-sensor__icon">
        <component :is="typeIcon" class="cui-binary-sensor__icon-svg" :style="detected ? detectedIconStyle : clearIconStyle" />
      </div>

      <div class="cui-binary-sensor__info">
        <span v-if="label" class="cui-binary-sensor__label">{{ label }}</span>
        <span class="cui-binary-sensor__status" :class="statusClass">
          {{ detected ? t('components.binary_sensor.detected') : t('components.binary_sensor.clear') }}
        </span>
      </div>

      <div class="cui-binary-sensor__indicator" :class="indicatorClass" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { sensorTypeIcon } from '@/common/sensorIcons.js';
import { CUI_BINARY_SENSOR_DEFAULTS } from './types.js';

import type { CuiBinarySensorProps } from './types.js';

const props = withDefaults(defineProps<CuiBinarySensorProps>(), CUI_BINARY_SENSOR_DEFAULTS);

const { t } = useI18n();

const { type, detected } = toRefs(props);

const typeIcon = computed(() => sensorTypeIcon(type.value));

const detectedIconStyle = computed<Record<string, string>>(() => ({
  color: 'rgb(239, 68, 68)',
  filter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.5))',
}));

const clearIconStyle = computed<Record<string, string>>(() => ({
  color: 'var(--text-secondary-color)',
}));

const statusClass = computed(() => (detected.value ? 'cui-binary-sensor__status--detected' : 'cui-binary-sensor__status--clear'));

const indicatorClass = computed(() => (detected.value ? 'cui-binary-sensor__indicator--detected' : 'cui-binary-sensor__indicator--clear'));
</script>

<style scoped>
.cui-binary-sensor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.cui-binary-sensor--disabled {
  opacity: 0.6;
}

.cui-binary-sensor__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cui-binary-sensor__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
}

.cui-binary-sensor__icon-svg {
  width: 1.5rem;
  height: 1.5rem;
  transition:
    color 0.2s ease,
    filter 0.2s ease;
}

.cui-binary-sensor__info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0;
}

.cui-binary-sensor__label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-color);
}

.cui-binary-sensor__status {
  font-size: 0.75rem;
  font-weight: 500;
}

.cui-binary-sensor__status--detected {
  color: rgb(239, 68, 68);
}

.cui-binary-sensor__status--clear {
  color: var(--text-secondary-color);
}

.cui-binary-sensor__indicator {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.cui-binary-sensor__indicator--detected {
  background-color: rgb(239, 68, 68);
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
  animation: pulse-indicator 1.5s ease-in-out infinite;
}

.cui-binary-sensor__indicator--clear {
  background-color: var(--text-secondary-color);
}

@keyframes pulse-indicator {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.cui-binary-sensor--small {
  padding: 0.5rem;
  gap: 0.375rem;
}

.cui-binary-sensor--small .cui-binary-sensor__icon {
  width: 1.25rem;
  height: 1.25rem;
}

.cui-binary-sensor--small .cui-binary-sensor__icon-svg {
  width: 1.125rem;
  height: 1.125rem;
}

.cui-binary-sensor--small .cui-binary-sensor__label {
  font-size: 0.75rem;
}

.cui-binary-sensor--small .cui-binary-sensor__status {
  font-size: 0.625rem;
}

.cui-binary-sensor--small .cui-binary-sensor__indicator {
  width: 0.375rem;
  height: 0.375rem;
}

.cui-binary-sensor--large {
  padding: 1rem;
  gap: 0.75rem;
}

.cui-binary-sensor--large .cui-binary-sensor__icon {
  width: 2.25rem;
  height: 2.25rem;
}

.cui-binary-sensor--large .cui-binary-sensor__icon-svg {
  width: 2rem;
  height: 2rem;
}

.cui-binary-sensor--large .cui-binary-sensor__label {
  font-size: 1rem;
}

.cui-binary-sensor--large .cui-binary-sensor__status {
  font-size: 0.875rem;
}

.cui-binary-sensor--large .cui-binary-sensor__indicator {
  width: 0.625rem;
  height: 0.625rem;
}
</style>
