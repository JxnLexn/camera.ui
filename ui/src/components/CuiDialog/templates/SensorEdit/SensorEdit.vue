<template>
  <div class="flex flex-col gap-4 w-full">
    <div v-if="hasWidget" class="flex flex-col field-gap">
      <label class="cui-label">{{ $t('views.sensors.control') }}</label>
      <CuiSensorControl v-if="liveSensor" :sensor="liveSensor" :disabled="!canControl" />
      <Message v-else severity="secondary" variant="simple" size="small" class="cui-input-hint">
        {{ $t('views.sensors.control_offline') }}
      </Message>
    </div>

    <div class="flex flex-col field-gap">
      <label for="sensorDisplayName" class="cui-label">{{ $t('components.camera_options.sensor_display_name') }}</label>
      <InputText id="sensorDisplayName" v-model.trim="displayName" class="w-full" />
    </div>

    <div class="flex flex-col field-gap">
      <label class="cui-label">{{ $t('views.sensors.assigned_cameras') }}</label>
      <Select
        v-if="sensor.cameraBound"
        :model-value="assignedCameraIds[0] ?? null"
        :options="cameraOptions"
        option-label="label"
        option-value="value"
        show-clear
        :placeholder="$t('views.sensors.assigned_cameras_placeholder')"
        class="w-full"
        @update:model-value="(value) => (assignedCameraIds = value ? [String(value)] : [])"
      />
      <MultiSelect
        v-else
        v-model="assignedCameraIds"
        :options="cameraOptions"
        option-label="label"
        option-value="value"
        :placeholder="$t('views.sensors.assigned_cameras_placeholder')"
        class="w-full"
      />
      <Message severity="secondary" variant="simple" size="small" class="cui-input-hint">
        {{ sensor.cameraBound ? $t('views.sensors.assigned_cameras_bound_hint') : $t('views.sensors.assigned_cameras_hint') }}
      </Message>
    </div>

    <div v-if="!sensor.cameraBound" class="flex items-center gap-4 cui-toggle-switch">
      <div class="flex flex-col min-w-0">
        <label class="cui-label-switch">{{ $t('views.sensors.exposed') }}</label>
        <span class="text-xs text-muted">{{ $t('views.sensors.exposed_hint') }}</span>
      </div>
      <ToggleSwitch v-model="exposed" class="ml-auto shrink-0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAllSensors } from '@camera.ui/browser';

import CuiSensorControl from '@/components/CuiSensorControl/CuiSensorControl.vue';
import { hasSensorControlWidget } from '@/components/CuiSensorControl/types.js';

import type { CustomDialogComponent } from '@/composables/useCuiDialog.js';
import type { SensorEditProps, SensorEditResult } from './types.js';

const props = defineProps<SensorEditProps>();

const displayName = ref(props.sensor.displayName || props.sensor.name);
const assignedCameraIds = ref<string[]>([...props.sensor.assignedCameraIds]);
const exposed = ref(props.sensor.exposed);

const { sensors: allSensors } = useAllSensors();

const canControl = computed(() => hasPermission(undefined, 'admin'));
const hasWidget = computed(() => hasSensorControlWidget(props.sensor.type));
const liveSensor = computed(() => allSensors.value.find((sensor) => sensor.id === props.sensor.id));

defineExpose<CustomDialogComponent>({
  onConfirm: async (): Promise<SensorEditResult> => ({
    displayName: displayName.value || props.sensor.name,
    assignedCameraIds: assignedCameraIds.value,
    exposed: exposed.value,
  }),
});
</script>
