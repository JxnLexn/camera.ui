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

    <div v-if="isLoading" class="flex flex-1 min-h-0 flex-col items-center justify-center w-full gap-4 py-16">
      <ProgressSpinner stroke-width="5" class="w-[30px] h-[30px]" />
    </div>

    <div v-else-if="!sensors.length" class="flex flex-1 min-h-0 flex-col items-center justify-center w-full gap-4 py-20">
      <i-material-symbols:home-iot-device-outline class="w-12 h-12 text-muted" />
      <span class="text-muted text-sm">{{ t('views.sensors.no_sensors') }}</span>
    </div>

    <div v-else class="flex min-h-0 flex-col">
      <Card class="cui-card">
        <template #content>
          <CuiDataTable :value="visibleRows" striped-rows :pt="tablePtOptions" class="w-full" @row-click="(e: DataTableRowClickEvent) => handleRowClick(e.data)">
            <Column header="" header-class="p-2 pl-4 w-5 max-w-5" class="p-2 pl-4 w-5 max-w-5">
              <template #body="{ data }">
                <div class="flex items-center justify-center">
                  <Badge
                    v-tooltip="{ value: data.sensor.connected ? t('views.sensors.connected') : t('views.sensors.disconnected') }"
                    :style="{ background: data.sensor.connected ? 'green' : 'gray' }"
                  />
                </div>
              </template>
            </Column>
            <Column field="label" :header="t('views.sensors.name')" sortable header-class="p-2" class="p-2 w-full min-w-[180px] max-w-0">
              <template #body="{ data }">
                <div class="flex items-center gap-2 min-w-0" :class="rowClass(data)">
                  <component :is="sensorTypeIcon(data.sensor.type)" class="w-5 h-5 shrink-0 text-muted" />
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-bold text-color truncate">{{ data.label }}</span>
                      <i-mdi:eye-off-outline v-if="!data.sensor.exposed" v-tooltip="t('views.sensors.not_exposed')" class="w-4 h-4 shrink-0 text-muted" />
                    </div>
                    <span v-if="smBreakpoint" class="text-xs text-muted truncate">{{ data.typeLabel }} · {{ data.pluginLabel }}</span>
                  </div>
                </div>
              </template>
            </Column>
            <Column v-if="!smBreakpoint" field="typeLabel" :header="t('views.sensors.type')" sortable header-class="p-2 whitespace-nowrap" class="p-2 whitespace-nowrap">
              <template #body="{ data }">
                <span class="text-xs text-muted whitespace-nowrap" :class="rowClass(data)">{{ data.typeLabel }}</span>
              </template>
            </Column>
            <Column
              v-if="!smBreakpoint"
              field="pluginLabel"
              :header="t('views.sensors.plugin')"
              sortable
              header-class="p-2 whitespace-nowrap"
              class="p-2 whitespace-nowrap"
            >
              <template #body="{ data }">
                <Chip :label="data.pluginLabel" class="text-xs whitespace-nowrap" :class="rowClass(data)" />
              </template>
            </Column>
            <Column field="assignedLabel" :header="t('views.sensors.assigned_cameras')" sortable header-class="p-2 whitespace-nowrap" class="p-2 min-w-[140px]">
              <template #body="{ data }">
                <div class="flex items-center gap-1 min-w-0" :class="rowClass(data)">
                  <i-mdi:lock-outline
                    v-if="data.sensor.assignmentLocked"
                    v-tooltip="t('views.sensors.assigned_cameras_locked_hint')"
                    class="w-3.5 h-3.5 shrink-0 text-muted"
                  />
                  <span class="text-xs truncate" :class="data.assignedLabel ? 'text-muted' : 'text-muted italic'">
                    {{ data.assignedLabel || t('views.sensors.unassigned') }}
                  </span>
                </div>
              </template>
            </Column>
            <Column header="" header-class="p-2 pr-4 w-28" class="p-2 pr-4 w-28">
              <template #body="{ data }">
                <div class="flex items-center justify-end gap-1">
                  <Button
                    v-tooltip.left="t('views.sensors.history')"
                    text
                    rounded
                    severity="secondary"
                    class="cui-icon-sm shrink-0"
                    @click.stop="openHistoryDialog(data.sensor)"
                  >
                    <template #icon>
                      <i-mdi:history width="100%" height="100%" />
                    </template>
                  </Button>

                  <Button
                    v-if="isAdmin && !data.sensor.hidden"
                    v-tooltip.left="t('views.sensors.hide')"
                    text
                    rounded
                    severity="secondary"
                    class="cui-icon-sm shrink-0"
                    @click.stop="setSensorHidden(data.sensor, true)"
                  >
                    <template #icon>
                      <i-mdi:eye-off width="100%" height="100%" class="text-muted" />
                    </template>
                  </Button>
                  <Button
                    v-else-if="isAdmin"
                    v-tooltip.left="t('views.sensors.unhide')"
                    text
                    rounded
                    severity="secondary"
                    class="cui-icon-sm shrink-0"
                    @click.stop="setSensorHidden(data.sensor, false)"
                  >
                    <template #icon>
                      <i-mdi:eye width="100%" height="100%" class="text-muted" />
                    </template>
                  </Button>

                  <span v-if="isAdmin" v-tooltip.left="canDelete(data.sensor) ? t('views.sensors.delete') : t('views.sensors.delete_connected')" class="shrink-0">
                    <Button text rounded severity="danger" class="cui-icon-sm" :disabled="!canDelete(data.sensor)" @click.stop="confirmDelete(data.sensor)">
                      <template #icon>
                        <i-mdi:trash-can-outline width="100%" height="100%" />
                      </template>
                    </Button>
                  </span>
                </div>
              </template>
            </Column>
          </CuiDataTable>

          <div v-if="hiddenCount > 0" class="flex items-center justify-end mt-4">
            <Button
              severity="secondary"
              class="cui-button-medium"
              :label="showHidden ? t('views.sensors.hide_hidden') : `${t('views.sensors.show_hidden')} (${hiddenCount})`"
              @click="showHidden = !showHidden"
            />
          </div>
        </template>
      </Card>
    </div>

    <CuiFloatingButton
      v-if="isAdmin"
      :tooltip-props="{ value: t('views.sensors.create_virtual') }"
      :button-props="{ class: 'text-white' }"
      :icon="PlusIcon"
      :icon-props="{ width: '30px', height: '30px' }"
      @click="openCreateDialog"
    />
  </div>
</template>

<script lang="ts" setup>
import PlusIcon from '~icons/typcn/plus';

import { CamerasQuery } from '@/api/routes/cameras.js';
import { SensorsQuery } from '@/api/routes/sensors.js';
import { asyncComponent } from '@/common/asyncComponent.js';
import { sensorTypeIcon } from '@/common/sensorIcons.js';

import type { SensorEditResult } from '@/components/CuiDialog/templates/SensorEdit/types.js';
import type { VirtualSensorCreateResult } from '@/components/CuiDialog/templates/VirtualSensorCreate/types.js';
import type { PassThrough } from '@primevue/core';
import type { TransformedSensor } from '@shared/types';
import type { DataTablePassThroughOptions, DataTableRowClickEvent } from 'primevue';

interface SensorRow {
  sensor: TransformedSensor;
  label: string;
  typeLabel: string;
  pluginLabel: string;
  assignedLabel: string;
}

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

const tablePtOptions: PassThrough<DataTablePassThroughOptions> = {
  bodyRow: {
    class: 'text-sm text-secondary',
  },
  column: {
    columnTitle: {
      class: 'text-sm',
    },
  },
  datatable: {
    class: 'z-0',
  },
};

const searchQuery = ref('');
const showHidden = ref(false);

const isAdmin = computed(() => hasPermission(undefined, 'admin'));

const sensors = computed(() => sensorsData.value ?? []);

const cameraOptions = computed(() => (camerasData.value?.result ?? []).map((camera) => ({ label: camera.name, value: camera._id })));

const rows = computed<SensorRow[]>(() => {
  const query = searchQuery.value.toLowerCase().trim();

  return sensors.value
    .map((sensor) => ({
      sensor,
      label: sensor.displayName || sensor.name,
      typeLabel: t(`components.camera_options.sensor_type_${sensor.type}`),
      pluginLabel: sensor.virtual ? t('views.sensors.owner_virtual') : sensor.pluginName,
      assignedLabel: sensor.assignedCameraIds
        .map((id) => cameraOptions.value.find((camera) => camera.value === id)?.label)
        .filter(Boolean)
        .join(', '),
    }))
    .filter((row) => !query || [row.label, row.typeLabel, row.pluginLabel, row.assignedLabel].some((value) => value.toLowerCase().includes(query)))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const visibleRows = computed(() => (showHidden.value ? rows.value : rows.value.filter((row) => !row.sensor.hidden)));

const hiddenCount = computed(() => rows.value.filter((row) => row.sensor.hidden).length);

function rowClass(row: SensorRow): string {
  return row.sensor.hidden ? 'opacity-50' : '';
}

function canDelete(sensor: TransformedSensor): boolean {
  return sensor.virtual || !sensor.connected;
}

function handleRowClick(row: SensorRow) {
  if (!isAdmin.value || row.sensor.hidden) return;

  dialog.openComponentDialog(SensorEditDialog, {
    data: {
      title: row.label,
      confirmText: t('components.form.button.save'),
      contentProps: {
        sensor: row.sensor,
        cameraOptions: cameraOptions.value,
      },
    },
    onConfirm: async (result: SensorEditResult | null) => {
      if (!result) return;
      await patchSensor({ id: row.sensor.id, data: result });
    },
  });
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

async function setSensorHidden(sensor: TransformedSensor, hidden: boolean) {
  await patchSensor({ id: sensor.id, data: { hidden } });
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

<style scoped>
:deep(tr) {
  cursor: pointer !important;
}
</style>
