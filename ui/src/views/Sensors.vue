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

      <Button v-tooltip.left="{ value: t('views.sensors.settings') }" severity="secondary" outlined class="cui-button shrink-0" @click="menuRef?.toggleMenu($event)">
        <template #icon>
          <i-carbon:settings class="w-4.5 h-4.5" />
        </template>
      </Button>

      <CuiMenu
        ref="menuRef"
        :items="menuItems"
        :auto-hide="false"
        :popover="{
          pt: {
            root: { class: 'w-[22rem]' },
            content: {
              class: 'p-0! rounded-xl! overflow-hidden!',
            },
          },
        }"
      />
    </div>

    <div v-if="isLoading" class="flex flex-1 min-h-0 flex-col items-center justify-center w-full gap-4 py-16">
      <ProgressSpinner stroke-width="5" class="w-[30px] h-[30px]" />
    </div>

    <div v-else-if="!rows.length" class="flex flex-1 min-h-0 flex-col items-center justify-center w-full gap-4 py-20">
      <i-material-symbols:home-iot-device-outline class="w-12 h-12 text-muted" />
      <span class="text-muted text-sm">{{ sensors.length ? t('views.sensors.no_matches') : t('views.sensors.no_sensors') }}</span>
    </div>

    <div v-else-if="viewMode === 'cards'" class="flex min-h-0 flex-col">
      <div
        class="grid w-full gap-2"
        :style="{
          gridTemplateColumns: `repeat(auto-fill, minmax(${smBreakpoint ? '100%' : '300px'}, 1fr))`,
        }"
      >
        <div v-for="row in visibleRows" :key="row.sensor.id" class="relative">
          <div v-if="selectionMode" class="absolute inset-0 z-4 cursor-pointer" @click="toggleSelection(row.sensor.id)"></div>

          <Card class="cui-card h-full" :class="[rowClass(row), { 'cursor-pointer': isAdmin && !row.sensor.hidden }]" @click="handleRowClick(row)">
            <template #content>
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    v-if="selectionMode"
                    class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0"
                    :class="selectedIds.has(row.sensor.id) ? 'bg-primary border-primary' : 'border-color'"
                  >
                    <i-mdi:check v-if="selectedIds.has(row.sensor.id)" class="w-4 h-4 text-white" />
                  </div>
                  <component
                    :is="sensorTypeIcon(row.sensor.type)"
                    class="w-6 h-6 shrink-0 transition-colors"
                    :class="{ 'text-muted': !isSensorActive(row.sensor) }"
                    :style="isSensorActive(row.sensor) ? ACTIVE_ICON_STYLE : undefined"
                  />
                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center gap-2 min-w-0">
                      <span v-tooltip="row.label" class="font-bold text-color truncate">{{ row.label }}</span>
                      <i-mdi:eye-off-outline v-if="!row.sensor.exposed" v-tooltip="t('views.sensors.not_exposed')" class="w-4 h-4 shrink-0 text-muted" />
                    </div>
                    <span class="text-xs text-muted truncate">{{ row.typeLabel }} · {{ row.pluginLabel }}</span>
                    <span v-if="row.sensor.nativeId" v-tooltip="row.sensor.nativeId" class="text-xs text-muted truncate font-mono">{{ row.sensor.nativeId }}</span>
                  </div>
                  <Badge
                    v-tooltip="{ value: row.sensor.connected ? t('views.sensors.connected') : t('views.sensors.disconnected') }"
                    class="shrink-0"
                    :style="{ background: row.sensor.connected ? 'green' : 'gray' }"
                  />
                </div>

                <div class="flex items-center gap-1 min-w-0">
                  <i-mdi:lock-outline
                    v-if="row.sensor.assignmentLocked"
                    v-tooltip="t('views.sensors.assigned_cameras_locked_hint')"
                    class="w-3.5 h-3.5 shrink-0 text-muted"
                  />
                  <span class="text-xs truncate" :class="row.assignedLabel ? 'text-muted' : 'text-muted italic'">
                    {{ row.assignedLabel || t('views.sensors.unassigned') }}
                  </span>

                  <div class="flex items-center gap-1 ml-auto">
                    <Button
                      v-tooltip.left="t('views.sensors.history')"
                      text
                      rounded
                      severity="secondary"
                      class="cui-icon-sm shrink-0"
                      @click.stop="openHistoryDialog(row.sensor)"
                    >
                      <template #icon>
                        <i-mdi:history width="100%" height="100%" />
                      </template>
                    </Button>

                    <Button
                      v-if="isAdmin"
                      v-tooltip.left="row.sensor.hidden ? t('views.sensors.unhide') : t('views.sensors.hide')"
                      text
                      rounded
                      severity="secondary"
                      class="cui-icon-sm shrink-0"
                      @click.stop="setSensorHidden(row.sensor, !row.sensor.hidden)"
                    >
                      <template #icon>
                        <i-mdi:eye v-if="row.sensor.hidden" width="100%" height="100%" class="text-muted" />
                        <i-mdi:eye-off v-else width="100%" height="100%" class="text-muted" />
                      </template>
                    </Button>

                    <span v-if="isAdmin" v-tooltip.left="canDelete(row.sensor) ? t('views.sensors.delete') : t('views.sensors.delete_connected')" class="shrink-0">
                      <Button text rounded severity="danger" class="cui-icon-sm" :disabled="!canDelete(row.sensor)" @click.stop="confirmDelete(row.sensor)">
                        <template #icon>
                          <i-mdi:trash-can-outline width="100%" height="100%" />
                        </template>
                      </Button>
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>

      <div v-if="hiddenCount > 0" class="flex items-center justify-end mt-4">
        <Button
          severity="secondary"
          class="cui-button-medium"
          :label="showHidden ? t('views.sensors.hide_hidden') : `${t('views.sensors.show_hidden')} (${hiddenCount})`"
          @click="showHidden = !showHidden"
        />
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-col">
      <Card class="cui-card">
        <template #content>
          <CuiDataTable :value="visibleRows" striped-rows :pt="tablePtOptions" class="w-full" @row-click="(e: DataTableRowClickEvent) => handleRowClick(e.data)">
            <Column v-if="selectionMode" header="" header-class="p-2 pl-4 w-8 max-w-8" class="p-2 pl-4 w-8 max-w-8">
              <template #body="{ data }">
                <Checkbox :model-value="selectedIds.has(data.sensor.id)" binary size="small" @click.stop @update:model-value="toggleSelection(data.sensor.id)" />
              </template>
            </Column>
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
            <Column field="label" :header="t('views.sensors.name')" sortable header-class="p-2" class="p-2 w-[40%] min-w-[180px] max-w-0">
              <template #body="{ data }">
                <div class="flex items-center gap-2 min-w-0" :class="rowClass(data)">
                  <component
                    :is="sensorTypeIcon(data.sensor.type)"
                    class="w-5 h-5 shrink-0 transition-colors"
                    :class="{ 'text-muted': !isSensorActive(data.sensor) }"
                    :style="isSensorActive(data.sensor) ? ACTIVE_ICON_STYLE : undefined"
                  />
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-2 min-w-0">
                      <span v-tooltip="data.label" class="font-bold text-color truncate">{{ data.label }}</span>
                      <i-mdi:eye-off-outline v-if="!data.sensor.exposed" v-tooltip="t('views.sensors.not_exposed')" class="w-4 h-4 shrink-0 text-muted" />
                    </div>
                    <span v-if="smBreakpoint" class="text-xs text-muted truncate">{{ data.typeLabel }} · {{ data.pluginLabel }}</span>
                    <span v-if="smBreakpoint && data.nativeLabel" v-tooltip="data.nativeLabel" class="text-xs text-muted truncate font-mono">{{ data.nativeLabel }}</span>
                  </div>
                </div>
              </template>
            </Column>
            <Column
              v-if="!smBreakpoint"
              field="nativeLabel"
              :header="t('views.sensors.native_id')"
              sortable
              header-class="p-2 whitespace-nowrap cui-col-center"
              class="p-2 w-[28%] min-w-[160px] max-w-0 text-center"
            >
              <template #body="{ data }">
                <span v-if="data.nativeLabel" v-tooltip="data.nativeLabel" class="text-xs text-muted truncate font-mono block" :class="rowClass(data)">
                  {{ data.nativeLabel }}
                </span>
                <span v-else class="text-xs text-muted">—</span>
              </template>
            </Column>
            <Column
              v-if="!smBreakpoint"
              field="typeLabel"
              :header="t('views.sensors.type')"
              sortable
              header-class="p-2 whitespace-nowrap cui-col-center"
              class="p-2 whitespace-nowrap text-center"
            >
              <template #body="{ data }">
                <span class="text-xs text-muted whitespace-nowrap" :class="rowClass(data)">{{ data.typeLabel }}</span>
              </template>
            </Column>
            <Column
              v-if="!smBreakpoint"
              field="pluginLabel"
              :header="t('views.sensors.plugin')"
              sortable
              header-class="p-2 whitespace-nowrap cui-col-center"
              class="p-2 whitespace-nowrap text-center"
            >
              <template #body="{ data }">
                <Chip :label="data.pluginLabel" class="text-xs whitespace-nowrap" :class="rowClass(data)" />
              </template>
            </Column>
            <Column
              field="assignedLabel"
              :header="t('views.sensors.assigned_cameras')"
              sortable
              header-class="p-2 whitespace-nowrap cui-col-center"
              class="p-2 min-w-[140px] text-center"
            >
              <template #body="{ data }">
                <div class="flex items-center justify-center gap-1 min-w-0" :class="rowClass(data)">
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

    <CuiFloatingButtonGroup v-if="isAdmin" :force-visible="selectionMode">
      <template v-if="!selectionMode">
        <CuiFloatingButton
          v-if="visibleRows.length"
          grouped
          :tooltip-props="{ value: t('views.sensors.select') }"
          :button-props="{ severity: 'secondary' }"
          :icon="SelectIcon"
          :icon-props="{ width: '100%', height: '100%' }"
          @click="enterSelectionMode"
        />
        <CuiFloatingButton
          grouped
          :tooltip-props="{ value: viewMode === 'cards' ? t('views.sensors.view_table') : t('views.sensors.view_cards') }"
          :button-props="{ severity: 'secondary' }"
          :icon="viewMode === 'cards' ? TableIcon : GridIcon"
          :icon-props="{ width: '100%', height: '100%' }"
          @click="toggleViewMode"
        />
        <CuiFloatingButton
          grouped
          :tooltip-props="{ value: t('views.sensors.create_virtual') }"
          :button-props="{ class: 'text-white' }"
          :icon="PlusIcon"
          :icon-props="{ width: '30px', height: '30px' }"
          @click="openCreateDialog"
        />
      </template>

      <template v-else>
        <CuiFloatingButton
          grouped
          :tooltip-props="{ value: $t('components.form.tooltip.cancel_selection') }"
          :button-props="{ severity: 'secondary' }"
          :icon="CloseIcon"
          :icon-props="{ width: '100%', height: '100%' }"
          @click="exitSelectionMode"
        />
        <CuiFloatingButton
          grouped
          :tooltip-props="{ value: $t('components.form.tooltip.select_all') }"
          :button-props="{ severity: allSelected ? 'primary' : 'secondary' }"
          :icon="SelectAllIcon"
          :icon-props="{ width: '100%', height: '100%' }"
          @click="toggleSelectAll"
        />
        <CuiFloatingButton
          grouped
          :tooltip-props="{ value: t('views.sensors.hide_selected') }"
          :button-props="{ severity: 'secondary', disabled: !selectedItems.length || bulkBusy }"
          :icon="EyeOffIcon"
          :icon-props="{ width: '100%', height: '100%' }"
          @click="bulkSetHidden(true)"
        />
        <CuiFloatingButton
          grouped
          :tooltip-props="{ value: t('views.sensors.unhide_selected') }"
          :button-props="{ severity: 'secondary', disabled: !selectedItems.length || bulkBusy }"
          :icon="EyeIcon"
          :icon-props="{ width: '100%', height: '100%' }"
          @click="bulkSetHidden(false)"
        />
        <CuiFloatingButton
          grouped
          :tooltip-props="{ value: t('views.sensors.delete_selected') }"
          :button-props="{ severity: 'danger', disabled: !deletableSelected.length || bulkBusy }"
          :icon="TrashIcon"
          :icon-props="{ width: '100%', height: '100%' }"
          @click="confirmBulkDelete"
        />
      </template>
    </CuiFloatingButtonGroup>
  </div>
</template>

<script lang="ts" setup>
import { useAllSensors } from '@camera.ui/browser';
import { SensorType } from '@camera.ui/sdk';
import SelectAllIcon from '~icons/fluent/select-all-on-20-filled';
import CloseIcon from '~icons/mdi/close';
import EyeIcon from '~icons/mdi/eye';
import EyeOffIcon from '~icons/mdi/eye-off';
import TrashIcon from '~icons/mdi/trash-can-outline';
import GridIcon from '~icons/mingcute/grid-fill';
import TableIcon from '~icons/mingcute/table-2-line';
import SelectIcon from '~icons/tabler/dots-filled';
import PlusIcon from '~icons/typcn/plus';

import { CamerasQuery } from '@/api/routes/cameras.js';
import { SensorsQuery } from '@/api/routes/sensors.js';
import { asyncComponent } from '@/common/asyncComponent.js';
import { sensorTypeIcon } from '@/common/sensorIcons.js';
import { useCardSelection } from '@/composables/useCardSelection.js';

import type { SensorEditResult } from '@/components/CuiDialog/templates/SensorEdit/types.js';
import type { VirtualSensorCreateResult } from '@/components/CuiDialog/templates/VirtualSensorCreate/types.js';
import type { PassThrough } from '@primevue/core';
import type { TransformedSensor } from '@shared/types';
import type { DataTablePassThroughOptions, DataTableRowClickEvent } from 'primevue';

interface SensorRow {
  sensor: TransformedSensor;
  label: string;
  typeLabel: string;
  nativeLabel: string;
  pluginLabel: string;
  assignedLabel: string;
}

const SensorEditDialog = asyncComponent(() => import('@/components/CuiDialog/templates/SensorEdit/SensorEdit.vue'));
const SensorHistoryDialog = asyncComponent(() => import('@/components/CuiDialog/templates/SensorHistory/SensorHistory.vue'));
const VirtualSensorCreateDialog = asyncComponent(() => import('@/components/CuiDialog/templates/VirtualSensorCreate/VirtualSensorCreate.vue'));

const ACTIVE_ICON_STYLE: Record<string, string> = {
  color: 'rgb(251, 146, 60)',
  filter: 'drop-shadow(0 0 6px rgba(251, 146, 60, 0.6))',
};

const DETECTED_ACTIVE_TYPES: ReadonlySet<string> = new Set([
  SensorType.Motion,
  SensorType.Object,
  SensorType.Audio,
  SensorType.Face,
  SensorType.LicensePlate,
  SensorType.Classifier,
  SensorType.Contact,
  SensorType.Occupancy,
  SensorType.Smoke,
  SensorType.Leak,
  SensorType.Gas,
  SensorType.CarbonMonoxide,
  SensorType.Heat,
  SensorType.Cold,
  SensorType.Vibration,
  SensorType.Tamper,
  SensorType.Problem,
  SensorType.Power,
]);

const sensorsQuery = new SensorsQuery();
const camerasQuery = new CamerasQuery();

const dialog = useCuiDialog();
const toast = useCuiToast();
const { t } = useI18n();
const { smBreakpoint } = useSharedCuiBreakpoint();

const uiStore = useUiStore();
const { uiSettings } = storeToRefs(uiStore);

const { sensors: liveSensors } = useAllSensors();

const { data: sensorsData, isBusy: isLoading } = sensorsQuery.getSensorsQuery();
const { data: camerasData } = camerasQuery.getCamerasQuery({ page: 1, pageSize: -1 });
const { mutateAsync: createVirtualSensor, isPending: isCreating } = sensorsQuery.createVirtualSensorQuery();
const { mutateAsync: patchSensor } = sensorsQuery.patchSensorQuery();
const { mutateAsync: deleteSensor, isPending: isDeleting } = sensorsQuery.deleteSensorQuery();
const { mutateAsync: bulkDeleteSensors } = sensorsQuery.bulkDeleteSensorsQuery();
const { mutateAsync: bulkPatchSensors } = sensorsQuery.bulkPatchSensorsQuery();

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

const menuRef = useTemplateRef('menuRef');

const searchQuery = ref('');
const showHidden = ref(false);

const isAdmin = computed(() => hasPermission(undefined, 'admin'));

const sensors = computed(() => sensorsData.value ?? []);

const cameraBoundCount = computed(() => sensors.value.filter((sensor) => sensor.assignmentLocked).length);

const menuItems = computed(() => [
  {
    key: 'hideCameraBound',
    label: t('views.sensors.hide_camera_bound'),
    description: t('views.sensors.hide_camera_bound_hint'),
    badge: cameraBoundCount.value ? String(cameraBoundCount.value) : undefined,
    toggle: true,
    toggleState: uiSettings.value.sensors.hideCameraBound,
    onClick: () => (uiSettings.value.sensors.hideCameraBound = !uiSettings.value.sensors.hideCameraBound),
  },
]);

const cameraOptions = computed(() => (camerasData.value?.result ?? []).map((camera) => ({ label: camera.name, value: camera._id })));

const rows = computed<SensorRow[]>(() => {
  const query = searchQuery.value.toLowerCase().trim();

  return sensors.value
    .map((sensor) => ({
      sensor,
      label: sensor.displayName || sensor.name,
      typeLabel: t(`components.camera_options.sensor_type_${sensor.type}`),
      nativeLabel: sensor.nativeId ?? '',
      pluginLabel: sensor.virtual ? t('views.sensors.owner_virtual') : sensor.pluginName,
      assignedLabel: sensor.assignedCameraIds
        .map((id) => cameraOptions.value.find((camera) => camera.value === id)?.label)
        .filter(Boolean)
        .join(', '),
    }))
    .filter((row) => !uiSettings.value.sensors.hideCameraBound || !row.sensor.assignmentLocked)
    .filter((row) => !query || [row.label, row.typeLabel, row.nativeLabel, row.pluginLabel, row.assignedLabel].some((value) => value.toLowerCase().includes(query)))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const visibleRows = computed(() => (showHidden.value ? rows.value : rows.value.filter((row) => !row.sensor.hidden)));

const hiddenCount = computed(() => rows.value.filter((row) => row.sensor.hidden).length);

const viewMode = computed(() => uiSettings.value.sensors.view);

const liveSensorById = computed(() => new Map(liveSensors.value.map((sensor) => [sensor.id, sensor])));

const { selectionMode, selectedIds, selectedItems, allSelected, bulkBusy, enterSelectionMode, exitSelectionMode, toggleSelectAll, toggleSelection } = useCardSelection(
  () => visibleRows.value,
  (row) => row.sensor.id,
);

const deletableSelected = computed(() => selectedItems.value.filter((row) => canDelete(row.sensor)));

function toggleViewMode() {
  uiSettings.value.sensors.view = viewMode.value === 'cards' ? 'table' : 'cards';
}

function isSensorActive(sensor: TransformedSensor): boolean {
  const live = liveSensorById.value.get(sensor.id);
  const get = (property: string): unknown => (live ? live.getProperty(property) : (sensor.properties as Record<string, unknown> | undefined)?.[property]);

  switch (sensor.type) {
    case SensorType.Light:
    case SensorType.Switch:
      return !!get('on');
    case SensorType.Siren:
      return !!get('active');
    case SensorType.Doorbell:
      return !!get('ring');
    case SensorType.Garage:
    case SensorType.Lock:
      return get('currentState') === 0;
    case SensorType.SecuritySystem:
      return get('currentState') === 4;
    case SensorType.Battery:
      return !!get('low');
    default:
      return DETECTED_ACTIVE_TYPES.has(String(sensor.type)) && !!get('detected');
  }
}

function rowClass(row: SensorRow): string {
  return row.sensor.hidden ? 'opacity-50' : '';
}

function canDelete(sensor: TransformedSensor): boolean {
  return sensor.virtual || !sensor.connected;
}

function handleRowClick(row: SensorRow) {
  if (selectionMode.value) {
    toggleSelection(row.sensor.id);
    return;
  }
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

function reportBulk(done: number, failed: string[], doneKey: string): void {
  if (failed.length) {
    toast.add({ severity: 'error', summary: t('views.sensors.bulk_failed', { count: failed.length }), detail: failed.join(', '), life: 8000 });
  }
  if (done) {
    toast.add({ severity: 'success', detail: t(doneKey, { count: done }), life: 5000 });
  }
}

async function bulkSetHidden(hidden: boolean) {
  const targets = [...selectedItems.value];
  bulkBusy.value = true;
  try {
    const { succeeded, failed } = await bulkPatchSensors({ ids: targets.map((row) => row.sensor.id), data: { hidden } });
    const failedLabels = targets.filter((row) => failed.some((entry) => entry.id === row.sensor.id)).map((row) => row.label);
    exitSelectionMode();
    reportBulk(succeeded.length, failedLabels, hidden ? 'views.sensors.hide_selected_done' : 'views.sensors.unhide_selected_done');
  } catch (error: any) {
    toast.add({ severity: 'error', detail: error?.response?.data?.message ?? error?.message ?? String(error), life: 5000 });
  } finally {
    bulkBusy.value = false;
  }
}

function confirmBulkDelete() {
  const targets = [...deletableSelected.value];
  dialog.openTextDialog({
    data: {
      title: t('components.dialog.title.confirm'),
      contentText: t('views.sensors.delete_selected_confirm', { count: targets.length }),
      confirmText: t('components.form.button.remove'),
      confirmButtonProps: {
        severity: 'danger',
      },
    },
    onConfirm: async () => {
      bulkBusy.value = true;
      try {
        const { skipped } = await bulkDeleteSensors({ ids: targets.map((row) => row.sensor.id) });
        const failed = targets.filter((row) => skipped.includes(row.sensor.id)).map((row) => row.label);
        exitSelectionMode();
        reportBulk(targets.length - failed.length, failed, 'views.sensors.delete_selected_done');
      } finally {
        bulkBusy.value = false;
      }
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

<style scoped>
:deep(tr) {
  cursor: pointer !important;
}

:deep(.cui-col-center .p-datatable-column-header-content) {
  justify-content: center;
}
</style>
