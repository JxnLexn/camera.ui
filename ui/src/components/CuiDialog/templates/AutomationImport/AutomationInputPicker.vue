<template>
  <div class="flex flex-col field-gap">
    <label class="cui-label">{{ input.label || input.key }}</label>

    <Select
      v-if="input.type === 'camera'"
      :model-value="modelValue"
      :options="cameraOptions"
      option-label="label"
      option-value="value"
      :placeholder="$t('components.automation_import.select_camera')"
      class="w-full"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <template v-else-if="input.type === 'plugin'">
      <Select
        :model-value="modelValue"
        :options="pluginOptions"
        option-label="label"
        option-value="value"
        :placeholder="$t('components.automation_import.select_plugin')"
        class="w-full"
        :disabled="!pluginOptions.length"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <Message v-if="!pluginOptions.length" severity="warn" variant="simple" size="small" class="cui-input-hint">
        {{ $t('components.automation_import.no_plugin_for_interface', { interface: input.interface }) }}
      </Message>
    </template>

    <MultiSelect
      v-else-if="input.type === 'notification-targets'"
      :model-value="modelValue"
      :options="userOptions"
      option-label="label"
      option-value="value"
      :placeholder="$t('components.automation_import.select_targets')"
      class="w-full"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <Select
      v-else-if="input.type === 'sensor'"
      :model-value="selectedSensorId"
      :options="sensorOptions"
      option-label="label"
      option-value="value"
      :placeholder="$t('components.automation_import.select_sensor')"
      class="w-full"
      :loading="sensorsLoading"
      filter
      @update:model-value="onSensorChange"
    />

    <InputText
      v-else-if="input.type === 'system-target'"
      :model-value="(modelValue as string) ?? ''"
      :placeholder="$t('components.automation_import.enter_target_id')"
      class="w-full"
      @update:model-value="emit('update:modelValue', $event ?? '')"
    />

    <InputText
      v-else-if="input.type === 'text'"
      :model-value="(modelValue as string) ?? ''"
      :placeholder="input.placeholder"
      class="w-full"
      @update:model-value="emit('update:modelValue', $event ?? '')"
    />
  </div>
</template>

<script setup lang="ts">
import { PluginsQuery } from '@/api/routes/plugins.js';
import { useCameraOptions } from '@/components/CuiAutomation/config/useCameraOptions.js';
import { useUserOptions } from '@/components/CuiAutomation/config/useUserOptions.js';

import type { SensorBinding } from '@/common/automationBlueprint.js';
import type { AutomationInputPickerEmits, AutomationInputPickerProps } from './types.js';

const pluginsQuery = new PluginsQuery();

const props = defineProps<AutomationInputPickerProps>();
const emit = defineEmits<AutomationInputPickerEmits>();

const { cameraOptions, useSensorOptions } = useCameraOptions();
const { userOptions } = useUserOptions();

const { data: pluginsData } = pluginsQuery.getPluginsQuery({ page: 1, pageSize: -1 });

const { sensorOptions, sensorById, isLoading: sensorsLoading } = useSensorOptions();

const pluginOptions = computed(() => {
  const required = props.input.interface;
  return (pluginsData.value?.result ?? [])
    .filter((plugin) => (required ? (plugin.contract?.interfaces ?? []).includes(required as never) : (plugin.contract?.interfaces?.length ?? 0) > 0))
    .map((plugin) => ({ label: plugin.displayName || plugin.pluginName, value: plugin.pluginName }));
});

const selectedSensorId = computed(() => (props.modelValue as SensorBinding | undefined)?.sensorId ?? '');

function onSensorChange(value: unknown) {
  const sensor = sensorById(String(value ?? ''));
  if (!sensor) return;
  emit('update:modelValue', { sensorId: sensor.id, sensorType: String(sensor.type) } satisfies SensorBinding);
}
</script>
