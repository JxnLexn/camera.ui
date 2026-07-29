<template>
  <div class="flex flex-col">
    <h1 v-if="!smBreakpoint" class="page-title">
      {{ t('views.sensors.title') }}
    </h1>

    <CuiTopbarSlot position="left">
      <Button severity="secondary" text class="cui-button p-2 text-color non-draggable-region" @click="$router.push('/menu')">
        <template #icon>
          <i-weui:back-filled class="w-6 h-6" />
        </template>
      </Button>
    </CuiTopbarSlot>

    <div class="flex gap-2 mb-4">
      <IconField class="flex-1">
        <InputIcon>
          <i-carbon:search class="w-4 h-4" />
        </InputIcon>
        <InputText v-model="searchQuery" :placeholder="t('views.sensors.search')" class="w-full" />
      </IconField>
    </div>

    <Transition name="fade-2" mode="out-in">
      <div
        v-if="isLoading"
        key="loading"
        class="grid w-full gap-2"
        :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${smBreakpoint ? '100%' : `${CARD_MIN_WIDTH}px`}, 1fr))` }"
      >
        <Skeleton v-for="i in 8" :key="i" :height="`${CARD_HEIGHT}px`" class="cui-card" />
      </div>

      <div v-else-if="filteredSensors.length" key="content" class="flex flex-col gap-4 w-full">
        <div v-for="group in groupedSensors" :key="group.key" class="flex flex-col gap-2">
          <h2 v-if="viewMode === 'grouped'" class="text-color font-medium text-base mt-2">{{ group.label }}</h2>

          <div class="grid w-full gap-2" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${smBreakpoint ? '100%' : `${CARD_MIN_WIDTH}px`}, 1fr))` }">
            <Card
              v-for="sensor in group.sensors"
              :key="sensor.id"
              class="cui-card cursor-pointer transition-shadow hover:shadow-md"
              :style="{ height: `${CARD_HEIGHT}px` }"
              :pt="{ body: { class: 'p-0 h-full' }, content: { class: 'h-full' } }"
              @click="openEditDialog(sensor)"
            >
              <template #content>
                <div class="flex items-center gap-3 px-3 h-full">
                  <component :is="sensorTypeIcon(sensor.type)" class="w-6 h-6 shrink-0 text-muted" />

                  <div class="flex flex-col flex-1 min-w-0">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-sm font-medium truncate">{{ sensor.displayName || sensor.name }}</span>
                      <span class="w-2 h-2 rounded-full shrink-0" :class="sensor.connected ? 'bg-green-500' : 'bg-gray-400'" />
                    </div>
                    <span class="text-xs text-muted truncate">
                      {{ t(`components.camera_options.sensor_type_${sensor.type}`) }}
                      · {{ sensor.virtual ? t('views.sensors.owner_virtual') : sensor.pluginName }}
                    </span>
                    <span class="text-xs text-muted truncate">
                      {{ assignedNames(sensor) || t('views.sensors.unassigned') }}
                    </span>
                  </div>

                  <i-mdi:eye-off-outline v-if="!sensor.exposed" v-tooltip.left="t('views.sensors.not_exposed')" class="w-4 h-4 shrink-0 text-muted" />

                  <Button
                    v-tooltip.left="t('views.sensors.history')"
                    text
                    rounded
                    severity="secondary"
                    class="cui-icon-sm shrink-0"
                    @click.stop="openHistoryDialog(sensor)"
                  >
                    <template #icon>
                      <i-mdi:history width="100%" height="100%" />
                    </template>
                  </Button>

                  <Button
                    v-if="isAdmin"
                    v-tooltip.left="t('views.sensors.delete')"
                    text
                    rounded
                    severity="danger"
                    class="cui-icon-sm shrink-0"
                    @click.stop="confirmDelete(sensor)"
                  >
                    <template #icon>
                      <i-mdi:trash-can-outline width="100%" height="100%" />
                    </template>
                  </Button>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </div>

      <div v-else key="empty" class="flex flex-1 min-h-0 flex-col items-center justify-center w-full gap-4 py-20">
        <i-material-symbols:home-iot-device-outline class="w-12 h-12 text-muted" />
        <span class="text-muted text-sm">{{ t('views.sensors.no_sensors') }}</span>
      </div>
    </Transition>

    <CuiFloatingButtonGroup>
      <CuiFloatingButton
        v-if="sensors.length > 1"
        grouped
        :tooltip-props="{ value: viewMode === 'default' ? $t('components.form.tooltip.view_grouped') : $t('components.form.tooltip.view_default') }"
        :button-props="{ severity: viewMode === 'default' ? 'secondary' : 'primary' }"
        :icon="viewMode === 'default' ? GridIcon : GroupIcon"
        :icon-props="{ width: '100%', height: '100%' }"
        @click="toggleViewMode"
      />
      <CuiFloatingButton
        v-if="isAdmin"
        grouped
        :tooltip-props="{ value: t('views.sensors.create_virtual') }"
        :button-props="{ class: 'text-white' }"
        :icon="PlusIcon"
        :icon-props="{ width: '30px', height: '30px' }"
        @click="openCreateDialog"
      />
    </CuiFloatingButtonGroup>
  </div>
</template>

<script lang="ts" setup>
import GroupIcon from '~icons/mdi/view-agenda';
import GridIcon from '~icons/mdi/view-grid';
import PlusIcon from '~icons/typcn/plus';

import { CamerasQuery } from '@/api/routes/cameras.js';
import { SensorsQuery } from '@/api/routes/sensors.js';
import { asyncComponent } from '@/common/asyncComponent.js';
import { sensorTypeIcon } from '@/common/sensorIcons.js';

import type { SensorEditResult } from '@/components/CuiDialog/templates/SensorEdit/types.js';
import type { VirtualSensorCreateResult } from '@/components/CuiDialog/templates/VirtualSensorCreate/types.js';
import type { TransformedSensor } from '@shared/types';

const SensorEditDialog = asyncComponent(() => import('@/components/CuiDialog/templates/SensorEdit/SensorEdit.vue'));
const SensorHistoryDialog = asyncComponent(() => import('@/components/CuiDialog/templates/SensorHistory/SensorHistory.vue'));
const VirtualSensorCreateDialog = asyncComponent(() => import('@/components/CuiDialog/templates/VirtualSensorCreate/VirtualSensorCreate.vue'));

const sensorsQuery = new SensorsQuery();
const camerasQuery = new CamerasQuery();

const dialog = useCuiDialog();
const { t } = useI18n();
const { smBreakpoint } = useSharedCuiBreakpoint();

const { data: sensorsData, isBusy: isLoading } = sensorsQuery.getSensorsQuery();
const { data: camerasData } = camerasQuery.getCamerasQuery({ page: 1, pageSize: -1 });
const { mutateAsync: createVirtualSensor, isPending: isCreating } = sensorsQuery.createVirtualSensorQuery();
const { mutateAsync: patchSensor } = sensorsQuery.patchSensorQuery();
const { mutateAsync: deleteSensor, isPending: isDeleting } = sensorsQuery.deleteSensorQuery();

const CARD_MIN_WIDTH = 350;
const CARD_HEIGHT = 82;

const searchQuery = ref('');
const viewMode = useLocalStorage<'default' | 'grouped'>('sensors-view-mode', 'default');

const isAdmin = computed(() => hasPermission(undefined, 'admin'));

const sensors = computed(() => sensorsData.value ?? []);

const cameraOptions = computed(() => (camerasData.value?.result ?? []).map((camera) => ({ label: camera.name, value: camera._id })));

const filteredSensors = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  const matched = query
    ? sensors.value.filter(
        (sensor) =>
          (sensor.displayName || sensor.name).toLowerCase().includes(query) ||
          sensor.pluginName.toLowerCase().includes(query) ||
          String(sensor.type).toLowerCase().includes(query),
      )
    : sensors.value;
  return [...matched].sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
});

const groupedSensors = computed(() => {
  if (viewMode.value === 'default') {
    return [{ key: 'all', label: '', sensors: filteredSensors.value }];
  }

  const groups = new Map<string, TransformedSensor[]>();
  for (const sensor of filteredSensors.value) {
    const list = groups.get(String(sensor.type)) ?? [];
    list.push(sensor);
    groups.set(String(sensor.type), list);
  }

  return [...groups.entries()]
    .map(([type, groupSensors]) => ({ key: type, label: t(`components.camera_options.sensor_type_${type}`), sensors: groupSensors }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

function toggleViewMode() {
  viewMode.value = viewMode.value === 'default' ? 'grouped' : 'default';
}

function openHistoryDialog(sensor: TransformedSensor) {
  dialog.openComponentDialog(SensorHistoryDialog, {
    data: {
      title: `${sensor.displayName || sensor.name} · ${t('views.sensors.history')}`,
      hideConfirmButton: true,
      contentProps: {
        sensorId: sensor.id,
        sensorType: String(sensor.type),
      },
    },
  });
}

function assignedNames(sensor: TransformedSensor): string {
  return sensor.assignedCameraIds
    .map((id) => cameraOptions.value.find((camera) => camera.value === id)?.label)
    .filter(Boolean)
    .join(', ');
}

function openEditDialog(sensor: TransformedSensor) {
  if (!isAdmin.value) return;

  dialog.openComponentDialog(SensorEditDialog, {
    data: {
      title: sensor.displayName || sensor.name,
      confirmText: t('components.form.button.save'),
      contentProps: {
        sensor,
        cameraOptions: cameraOptions.value,
      },
    },
    onConfirm: async (result: SensorEditResult | null) => {
      if (!result) return;
      await patchSensor({ id: sensor.id, data: result });
    },
  });
}

function openCreateDialog() {
  dialog.openComponentDialog(VirtualSensorCreateDialog, {
    data: {
      title: t('views.sensors.create_virtual'),
      confirmText: t('components.form.button.save'),
      loading: isCreating,
      contentProps: {},
    },
    onConfirm: async (result: VirtualSensorCreateResult | null) => {
      if (!result) return;
      await createVirtualSensor({ data: result });
    },
  });
}

function confirmDelete(sensor: TransformedSensor) {
  dialog.openTextDialog({
    data: {
      title: t('views.sensors.delete'),
      contentText: t('views.sensors.delete_confirm'),
      confirmText: t('components.form.button.remove'),
      loading: isDeleting,
      confirmButtonProps: {
        severity: 'danger',
      },
    },
    onConfirm: async () => {
      await deleteSensor({ id: sensor.id });
    },
  });
}
</script>
