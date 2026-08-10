<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col field-gap">
      <label class="cui-label">{{ t('components.automation_nodes.sensor_label') }}</label>
      <Select
        :model-value="data.sensorId"
        :options="sensorOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('components.automation_nodes.sensor_placeholder')"
        class="w-full"
        :loading="isLoading"
        filter
        @update:model-value="onSensorChange"
      />
    </div>

    <div class="flex flex-col field-gap">
      <label class="cui-label">{{ t('components.automation_nodes.sensor_properties') }}</label>
      <MultiSelect
        :model-value="data.properties"
        :options="propertyOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('components.automation_nodes.sensor_properties_placeholder')"
        class="w-full"
        :disabled="!data.sensorId"
        @update:model-value="update('properties', $event)"
      />
      <Message severity="secondary" variant="simple" size="small" class="cui-input-hint">{{ t('components.automation_nodes.sensor_properties_hint') }}</Message>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCameraOptions } from './useCameraOptions.js';

import type { ConfigNodeUpdateEmits, ConfigTriggerSensorProps } from '../types.js';

const props = defineProps<ConfigTriggerSensorProps>();

const emit = defineEmits<ConfigNodeUpdateEmits>();

const { t } = useI18n();
const { useSensorOptions, getPropertiesForSensor } = useCameraOptions();

const { sensorOptions, sensorById, isLoading } = useSensorOptions();

const propertyOptions = computed(() => {
  if (!props.data.sensorType) return [];
  return getPropertiesForSensor(props.data.sensorType);
});

function onSensorChange(value: unknown) {
  const sensor = sensorById(String(value ?? ''));
  emit('update:data', { sensorId: value, sensorType: sensor ? String(sensor.type) : '', properties: [] });
}

function update(key: string, value: unknown) {
  emit('update:data', { [key]: value });
}
</script>
