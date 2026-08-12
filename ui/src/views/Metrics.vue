<template>
  <div>
    <h1 v-if="!smBreakpoint" class="page-title">
      {{ $t(`views.${String($route.name).toLowerCase()}.title`) }}
    </h1>

    <CuiTopbarSlot position="left">
      <Button severity="secondary" text class="cui-button p-2 text-color non-draggable-region" @click="$router.push('/menu')">
        <template #icon>
          <i-weui:back-filled class="w-6 h-6" />
        </template>
      </Button>
    </CuiTopbarSlot>

    <Tabs v-model:value="currentTab" class="metrics-tabs">
      <TabList class="mb-4">
        <Tab value="overview" class="text-sm">{{ $t('views.metrics.tab_overview') }}</Tab>
        <Tab value="cameras" class="text-sm">{{ $t('views.metrics.tab_cameras') }}</Tab>
        <Tab value="storage" class="text-sm">{{ $t('views.metrics.tab_storage') }}</Tab>
      </TabList>

      <TabPanels class="!p-0 !bg-transparent">
        <TabPanel value="overview">
          <div class="flex flex-col gap-6">
            <div>
              <span class="card-title">{{ $t('views.metrics.general') }}</span>
              <CuiChartTable :items="systemItems" :headers="headers('system')" :chart-data="systemChartData" :empty-message="$t('views.metrics.no_system')" />
            </div>

            <div>
              <span class="card-title">{{ $t('views.metrics.core') }}</span>
              <CuiChartTable :items="coreItems" :headers="headers('core')" :chart-data="coreChartData" :empty-message="$t('views.metrics.no_core')" />
            </div>

            <div>
              <span class="card-title">{{ $t('views.metrics.plugins') }}</span>
              <CuiChartTable
                :items="pluginItems"
                :headers="headers('plugins')"
                :chart-data="pluginsChartData"
                :loading="pluginsLoading"
                paginator
                :pagination="{ page: tablePages.plugins }"
                :total-records="pluginItems.length"
                :empty-message="$t('views.metrics.no_plugins')"
                @update:page="onPage($event, 'plugins')"
              />
            </div>
          </div>
        </TabPanel>

        <TabPanel value="cameras">
          <div>
            <span class="card-title">{{ $t('views.metrics.cameras') }}</span>
            <span class="block text-sm text-muted mb-3">{{ $t('views.metrics.cameras_hint') }}</span>
            <CuiChartTable
              :items="frameworkerItems"
              :headers="headers('frameworker')"
              :chart-data="frameworkerChartData"
              :loading="frameWorkersLoading"
              paginator
              :pagination="{ page: tablePages.frameworker }"
              :total-records="frameworkerItems.length"
              :empty-message="$t('views.metrics.no_cameras')"
              @update:page="onPage($event, 'frameworker')"
            />
          </div>
        </TabPanel>

        <TabPanel value="storage">
          <div class="flex flex-col gap-6">
            <div v-if="stats && stats.paused === true" class="cui-banner cui-banner-error">
              <i-mdi:alert-circle-outline class="shrink-0 w-5 h-5" />
              <span>{{ $t('views.metrics.disk_critical') }}</span>
            </div>
            <div v-else-if="stats && stats.diskFreePercent > 0 && stats.diskFreePercent < 8" class="cui-banner cui-banner-warn">
              <i-mdi:alert-outline class="shrink-0 w-5 h-5" />
              <span>{{ $t('views.metrics.disk_warning') }}</span>
            </div>

            <div v-if="stats && stats.smallVolume" class="cui-banner cui-banner-warn">
              <i-mdi:alert-outline class="shrink-0 w-5 h-5" />
              <span>{{ $t('views.metrics.disk_small_volume') }}</span>
            </div>

            <div>
              <span class="card-title">{{ $t('views.metrics.storage_overview') }}</span>
              <Card class="cui-card">
                <template #content>
                  <div v-if="storageStatsLoading && !stats" class="flex items-center justify-center py-8">
                    <ProgressSpinner class="w-[30px] h-[30px] m-0" stroke-width="5" />
                  </div>
                  <div v-else-if="!stats" class="text-sm text-muted text-center py-8">
                    {{ $t('views.metrics.storage_not_available') }}
                  </div>
                  <div v-else class="flex flex-col sm:flex-row items-center gap-6">
                    <div class="shrink-0" style="width: 180px; height: 180px">
                      <Doughnut :data="storageChartData" :options="storageChartOptions" />
                    </div>
                    <CuiDataTable :value="overviewRows" :pt="tablePtOptions" striped-rows :show-headers="false" class="w-full">
                      <Column field="label">
                        <template #body="{ data }">
                          <span class="text-color">{{ data.label }}</span>
                        </template>
                      </Column>
                      <Column field="value" style="text-align: right">
                        <template #body="{ data }">
                          <span class="font-medium">{{ data.value }}</span>
                        </template>
                      </Column>
                    </CuiDataTable>
                  </div>
                </template>
              </Card>
            </div>

            <div>
              <span class="card-title">{{ $t('views.metrics.camera_storage') }}</span>
              <Card class="cui-card">
                <template #content>
                  <div v-if="storageStatsLoading && !stats" class="flex items-center justify-center py-8">
                    <ProgressSpinner class="w-[30px] h-[30px] m-0" stroke-width="5" />
                  </div>
                  <div v-else-if="!stats" class="text-sm text-muted text-center py-8">
                    {{ $t('views.metrics.storage_not_available') }}
                  </div>
                  <CuiDataTable v-else :value="cameraRows" :pt="tablePtOptions" striped-rows scrollable>
                    <Column field="status" :header="''" style="width: 3rem">
                      <template #body="{ data }">
                        <div class="flex items-center justify-center">
                          <Badge
                            v-tooltip="{ value: data.isRecording ? $t('views.metrics.status_recording') : $t('views.metrics.status_stopped') }"
                            :style="{ background: data.isRecording ? 'green' : 'gray' }"
                          />
                        </div>
                      </template>
                    </Column>
                    <Column field="name" :header="$t('views.metrics.col_camera')">
                      <template #body="{ data }">
                        <span class="font-medium block max-w-[200px] truncate">{{ data.name }}</span>
                      </template>
                    </Column>
                    <Column field="size" :header="$t('views.metrics.col_size')">
                      <template #body="{ data }">
                        {{ formatBytes(data.usedBytes) }}
                      </template>
                    </Column>
                    <Column field="daysCount" :header="$t('views.metrics.col_days')" />
                    <Column field="rate" :header="$t('views.metrics.col_rate')">
                      <template #body="{ data }">
                        {{ data.bandwidthMBh > 0 ? formatRate(data.bandwidthMBh) : '-' }}
                      </template>
                    </Column>
                    <Column field="recordingMode" :header="$t('views.metrics.col_mode')">
                      <template #body="{ data }">
                        <Chip :label="data.recordingMode" class="text-xs" />
                      </template>
                    </Column>
                    <template #empty>
                      <span class="text-muted text-sm">{{ $t('views.metrics.no_cameras') }}</span>
                    </template>
                  </CuiDataTable>
                </template>
              </Card>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { useStorageStats } from '@camera.ui/nvr';
import { PLUGIN_STATUS, RUNTIME_STATUS } from '@shared/types';
import { ArcElement, Chart as ChartJS, DoughnutController, Tooltip } from 'chart.js';
import { Doughnut } from 'vue-chartjs';
import RestartIcon from '~icons/ic/round-restart-alt';

import { CamerasQuery } from '@/api/routes/cameras.js';
import { FrameWorkerQuery } from '@/api/routes/frameWorkers.js';
import { PluginsQuery } from '@/api/routes/plugins.js';
import { ServerQuery } from '@/api/routes/server.js';
import { isHeaderChart } from '@/components/CuiChartTable/types.js';
import { DEFAULT_PROCESS_LOAD, MAX_METRICS_DATA_POINTS } from '@/composables/sockets/useMetricsSocket.js';

import type { TableHeader, TableHeaderChart } from '@/components/CuiChartTable/types.js';
import type { PaginationQuery, ProcessInfo } from '@shared/types';
import type { ChartData, ChartOptions } from 'chart.js';
import type { DataTablePassThroughOptions } from 'primevue';

ChartJS.register(DoughnutController, ArcElement, Tooltip);

interface CameraStorageRow {
  id: string;
  name: string;
  usedBytes: number;
  daysCount: number;
  bandwidthMBh: number;
  recordingMode: string;
  isRecording: boolean;
}

interface OverviewRow {
  label: string;
  value: string;
}

const camerasQuery = new CamerasQuery();
const pluginsQuery = new PluginsQuery();
const frameWorkerQuery = new FrameWorkerQuery();
const serverQuery = new ServerQuery();

const { t } = useI18n();
const metricsSocket = useMetricsSocket();
const { mdBreakpoint, smBreakpoint } = useSharedCuiBreakpoint();
const { beginServerRestart } = useServerRestart();
const { stats, isLoading: storageStatsLoading } = useStorageStats();

const currentTab = ref('overview');
const tablePages = ref({ frameworker: 1, plugins: 1 });

const frameworkersPagination = ref<PaginationQuery>({ page: 1, pageSize: -1 });
const pluginsPagination = ref<PaginationQuery>({ page: 1, pageSize: -1 });

const { data: camerasData } = camerasQuery.getCamerasQuery({ page: 1, pageSize: -1 });
const { data: plugins, isBusy: pluginsLoading, suspense: pluginsSuspense } = pluginsQuery.getPluginsQuery(pluginsPagination);
const { data: frameWorkers, isBusy: frameWorkersLoading, suspense: frameWorkerSuspense } = frameWorkerQuery.getFrameWorkersQuery(frameworkersPagination);
const { mutateAsync: restartPlugin } = pluginsQuery.restartPluginQuery();
const { mutateAsync: restartFrameWorker } = frameWorkerQuery.restartFrameWorkerQuery();
const { mutate: restartGo2Rtc, isPending: restartGo2RtcLoading } = serverQuery.restartGo2RtcQuery();
const { mutate: restartServer, isPending: restartSystemLoading } = serverQuery.restartServerQuery();

const tablePtOptions: DataTablePassThroughOptions = {
  bodyRow: {
    class: 'text-sm text-secondary',
  },
  column: {
    columnTitle: {
      class: 'text-sm',
    },
  },
};

const frameWorkersRestarting = ref<string[]>([]);
const pluginsRestarting = ref<string[]>([]);

const systemProcess = metricsSocket.systemProcess;
const systemProcessInfo = metricsSocket.systemProcessInfo;
const serverStatus = metricsSocket.serverStatus;
const go2rtcStatus = metricsSocket.go2rtcStatus;
const natsStatus = metricsSocket.natsStatus;
const coreProcesses = metricsSocket.coreProcesses;
const coreProcessInfos = metricsSocket.coreProcessInfos;
const frameWorkerStatus = metricsSocket.frameWorkerStatus;
const frameWorkersProcess = metricsSocket.frameWorkersProcess;
const frameWorkersProcessInfos = metricsSocket.frameWorkersProcessInfos;
const pluginsStatus = metricsSocket.pluginsStatus;
const pluginsProcesses = metricsSocket.pluginsProcesses;
const pluginsProcessInfos = metricsSocket.pluginsProcessInfos;

const headers = computed<(type: 'system' | 'core' | 'frameworker' | 'plugins') => TableHeader[]>(() => {
  return (type) => {
    let headersObj: TableHeader[] = [
      {
        type: 'indicator',
        field: 'status',
        columnProps: {
          alignFrozen: 'left',
          frozen: !mdBreakpoint.value,
          headerClass: 'w-5 max-w-5',
          class: 'w-5 max-w-5',
        },
        color(item: ProcessInfo) {
          return getStatusColor(getStatus(type, item.name));
        },
        tooltip(item: ProcessInfo) {
          return getStatusText(getStatus(type, item.name));
        },
      },
      {
        type: 'category',
        field: 'name',
        altName: type === 'system' ? t('components.process_table.system') : undefined,
        name: t('components.process_table.title_name'),
        columnProps: {
          alignFrozen: 'left',
          frozen: !mdBreakpoint.value,
          headerClass: 'w-40 min-w-40 max-w-40',
          class: 'w-40 min-w-40 max-w-40',
        },
        props: {
          class: 'font-bold text-color',
        },
      },
      {
        type: 'category',
        field: 'pid',
        name: t('components.process_table.title_pid'),
        columnProps: {
          headerClass: 'min-w-20',
          class: 'min-w-20',
        },
      },
      {
        type: 'category',
        field: 'cpuLoad',
        suffix: '%',
        name: t('components.process_table.title_cpu'),
        asChip: true,
        columnProps: {
          headerClass: 'min-w-30',
          class: 'min-w-30',
        },
      },
      {
        type: 'chart',
        field: 'cpu_chart',
        for: 'cpuLoad',
        columnProps: {
          headerClass: 'min-w-[250px]',
          class: 'min-w-[250px]',
        },
      },
      {
        type: 'category',
        field: 'memLoad',
        suffix: '%',
        name: t('components.process_table.title_memory'),
        asChip: true,
        columnProps: {
          headerClass: 'min-w-30',
          class: 'min-w-30',
        },
      },
      {
        type: 'chart',
        field: 'memory_chart',
        for: 'memLoad',
        columnProps: {
          headerClass: 'min-w-[250px]',
          class: 'min-w-[250px]',
        },
      },
      {
        type: 'action',
        field: 'restart',
        icon: RestartIcon,
        columnProps: {
          class: 'text-right',
        },
        loading(item: ProcessInfo) {
          if (type === 'core') {
            return item.name === 'camera.ui' ? restartSystemLoading.value : restartGo2RtcLoading.value;
          }

          if (type === 'frameworker') {
            return frameWorkerRestarting.value(item.name);
          }

          if (type === 'plugins') {
            return pluginRestarting.value(item.name);
          }

          return false;
        },
        disabled(item: ProcessInfo) {
          return item.name === 'nats';
        },
        action(item: ProcessInfo) {
          if (item.type === 'core') {
            coreRestart(item.name as 'camera.ui' | 'go2rtc');
          }

          if (item.type === 'frameworker') {
            frameWorkerRestart(item.name);
          }

          if (item.type === 'plugin') {
            pluginRestart(item.name);
          }
        },
      },
    ];

    if (type === 'system') {
      headersObj = headersObj.filter((header) => header.field !== 'pid' && header.field !== 'restart' && header.field !== 'status');
    }

    if (type === 'frameworker') {
      headersObj.splice(headersObj.length - 1, 0, ...perfHeaders.value);
    }

    return headersObj;
  };
});

const perfHeaders = computed<TableHeader[]>(() => {
  const columnProps = { headerClass: 'min-w-24', class: 'min-w-24' };
  // a quiet minute measures nothing, the whole run still does: fall back to it
  // and mark the value, so a live number is never confused with an average
  const asAverage = (value: string) => `~${value}`;
  const externalIdle = (item: ProcessInfo) => Boolean(item.perf && !item.perf.frameAnalysis && item.perf.lowFps === 0);
  const idleTooltip = (item: ProcessInfo, average: number) => {
    if (average > 0) {
      const minutes = item.perf?.average.minutes ?? 0;
      return minutes >= 1 ? `${t('views.metrics.info_average')} (${minutes} min)` : t('views.metrics.info_average');
    }
    return externalIdle(item) ? t('views.metrics.info_external') : undefined;
  };

  return [
    {
      type: 'category',
      field(item: ProcessInfo) {
        if (!item.perf) return '-';
        if (item.perf.lowFps > 0) return item.perf.lowFps.toFixed(1);
        return item.perf.average.lowFps > 0 ? asAverage(item.perf.average.lowFps.toFixed(1)) : '-';
      },
      name: t('views.metrics.col_fps_low'),
      headerTooltip: t('views.metrics.info_fps_low'),
      columnProps,
      tooltip: (item: ProcessInfo) => (item.perf && item.perf.lowFps === 0 ? idleTooltip(item, item.perf.average.lowFps) : undefined),
    },
    {
      type: 'category',
      field(item: ProcessInfo) {
        if (!item.perf?.mainStreamEnabled) return '-';
        if (item.perf.activePercent > 0 && item.perf.mainFps > 0) return item.perf.mainFps.toFixed(1);
        return item.perf.average.mainFps > 0 ? asAverage(item.perf.average.mainFps.toFixed(1)) : '-';
      },
      name: t('views.metrics.col_fps_main'),
      headerTooltip: t('views.metrics.info_fps_main'),
      columnProps,
      tooltip: (item: ProcessInfo) => (item.perf?.mainStreamEnabled && item.perf.activePercent === 0 ? idleTooltip(item, item.perf.average.mainFps) : undefined),
    },
    {
      type: 'category',
      field(item: ProcessInfo) {
        if (!item.perf) return '-';
        if (item.perf.activePercent > 0) return `${item.perf.activePercent}%`;
        if (item.perf.average.activePercent > 0) return asAverage(`${item.perf.average.activePercent}%`);
        return externalIdle(item) ? '-' : '0%';
      },
      name: t('views.metrics.col_active'),
      headerTooltip: t('views.metrics.info_active'),
      columnProps,
      tooltip: (item: ProcessInfo) => (item.perf && item.perf.activePercent === 0 ? idleTooltip(item, item.perf.average.activePercent) : undefined),
    },
    {
      type: 'category',
      field(item: ProcessInfo) {
        if (!item.perf) return '-';
        if (item.perf.inferMs > 0) return `${item.perf.inferMs} ms`;
        return item.perf.average.inferMs > 0 ? asAverage(`${item.perf.average.inferMs} ms`) : '-';
      },
      name: t('views.metrics.col_inference'),
      headerTooltip: t('views.metrics.info_inference'),
      columnProps,
      tooltip(item: ProcessInfo) {
        if (!item.perf) return undefined;
        if (item.perf.inferMs === 0) return idleTooltip(item, item.perf.average.inferMs);
        return [
          `${t('views.metrics.tip_decode')}: ${item.perf.decodeMs} ms`,
          `${t('views.metrics.tip_scale')}: ${item.perf.scaleMs} ms`,
          `${t('views.metrics.tip_jpeg')}: ${item.perf.jpegMs} ms`,
          `${t('views.metrics.tip_secondary')}: ${item.perf.secondaryMs} ms`,
        ].join(' · ');
      },
    },
    {
      type: 'category',
      field(item: ProcessInfo) {
        if (!item.perf) return '-';
        const found = item.perf.objects + item.perf.faces + item.perf.plates;
        if (found > 0) return String(found);
        if (item.perf.average.detectionsPerMinute > 0) return asAverage(item.perf.average.detectionsPerMinute.toFixed(1));
        return externalIdle(item) ? '-' : '0';
      },
      name: t('views.metrics.col_detections'),
      headerTooltip: t('views.metrics.info_detections'),
      columnProps,
      tooltip(item: ProcessInfo) {
        if (!item.perf) return undefined;
        const found = item.perf.objects + item.perf.faces + item.perf.plates;
        if (found === 0) return idleTooltip(item, item.perf.average.detectionsPerMinute);
        return [
          `${t('views.metrics.tip_objects')}: ${item.perf.objects}`,
          `${t('views.metrics.tip_faces')}: ${item.perf.faces}`,
          `${t('views.metrics.tip_plates')}: ${item.perf.plates}`,
        ].join(' · ');
      },
    },
  ];
});

const systemItems = computed(() => systemProcess.value);
const coreItems = computed(() => Object.values(coreProcesses.value).filter(Boolean));
const frameworkerItems = computed(() => Object.values(frameWorkersProcess.value).filter(Boolean));
const pluginItems = computed(() =>
  Object.values(pluginsProcesses.value)
    .filter((item) => {
      const plugin = plugins.value?.result.find((p) => p.pluginName === item.name);
      return plugin && !plugin.disabled;
    })
    .filter(Boolean),
);

const systemChartData = computed(() => buildChartData('system', { system: systemProcessInfo.value }));
const coreChartData = computed(() => buildChartData('core', coreProcessInfos.value as unknown as Record<string, ProcessInfo[]>));
const frameworkerChartData = computed(() => buildChartData('frameworker', frameWorkersProcessInfos.value));
const pluginsChartData = computed(() => buildChartData('plugins', pluginsProcessInfos.value));

const pluginRestarting = computed<(pluginName: string) => boolean>(() => {
  return (pluginName: string) => {
    return pluginsRestarting.value.includes(pluginName);
  };
});

const frameWorkerRestarting = computed<(frameWorkerName: string) => boolean>(() => {
  return (frameWorkerName: string) => {
    return frameWorkersRestarting.value.includes(frameWorkerName);
  };
});

const cameraNameMap = computed(() => {
  const map = new Map<string, string>();
  for (const cam of camerasData.value?.result ?? []) {
    map.set(cam._id, cam.name);
  }
  return map;
});

const cameraRows = computed<CameraStorageRow[]>(() => {
  if (!stats.value?.cameras) return [];
  return Object.entries(stats.value.cameras)
    .map(([id, cam]) => ({
      id,
      name: cameraNameMap.value.get(id) || id,
      usedBytes: cam.usedBytes,
      daysCount: cam.daysCount,
      bandwidthMBh: cam.bandwidthMBh,
      recordingMode: cam.recordingMode,
      isRecording: cam.isRecording,
    }))
    .sort((a, b) => b.usedBytes - a.usedBytes);
});

const overviewRows = computed<OverviewRow[]>(() => {
  if (!stats.value) return [];
  return [
    { label: t('views.metrics.disk_total'), value: formatGB(stats.value.diskTotalGB) },
    { label: t('views.metrics.nvr_usage'), value: formatGB(stats.value.nvrUsedGB) },
    { label: t('views.metrics.quota'), value: stats.value.nvrQuotaGB > 0 ? formatGB(stats.value.nvrQuotaGB) : t('views.metrics.unlimited') },
    {
      label: t('views.metrics.retention'),
      value: stats.value.retentionDays > 0 ? t('views.metrics.days_count', { count: stats.value.retentionDays }) : t('views.metrics.unlimited'),
    },
    { label: t('views.metrics.disk_free'), value: `${formatGB(stats.value.diskFreeGB)} (${stats.value.diskFreePercent.toFixed(1)}%)` },
  ];
});

const storageChartData = computed<ChartData<'doughnut'>>(() => {
  const nvrUsed = stats.value?.nvrUsedGB ?? 0;
  const diskFree = stats.value?.diskFreeGB ?? 0;
  const otherUsed = Math.max(0, (stats.value?.diskUsedGB ?? 0) - nvrUsed);
  const isEmpty = nvrUsed === 0 && otherUsed === 0 && diskFree === 0;

  return {
    labels: [t('views.metrics.chart_nvr'), t('views.metrics.chart_other'), t('views.metrics.chart_free')],
    datasets: [
      {
        data: isEmpty ? [0, 0, 1] : [nvrUsed, otherUsed, diskFree],
        backgroundColor: ['#df2a4c', 'rgba(223,42,76,0.35)', 'rgba(223,42,76,0.10)'],
        borderWidth: 0,
      },
    ],
  };
});

const storageChartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  cutout: '65%',
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.label}: ${formatGB(ctx.parsed)}`,
      },
    },
  },
}));

function buildChartData(type: 'system' | 'core' | 'frameworker' | 'plugins', processMap: Record<string, ProcessInfo[]>): Record<string, ChartData<'bar'>> {
  return Object.keys(processMap).reduce((acc: Record<string, ChartData<'bar'>>, key) => {
    const chartsToProcess = headers.value(type).filter(isHeaderChart) as TableHeaderChart[];

    chartsToProcess.forEach((chart) => {
      const valueKey = chart.for as keyof ProcessInfo;
      const processData = processMap[key]
        .slice(-MAX_METRICS_DATA_POINTS)
        .filter((info) => info[valueKey] !== undefined)
        .map((info) => parseFloat(info[valueKey] as string));
      const timestamps = processMap[key].slice(-MAX_METRICS_DATA_POINTS).map((info) => info.timestamp);
      const data = [...processData, ...Array(MAX_METRICS_DATA_POINTS - processData.length).fill(0)];
      const labels = [...timestamps, ...Array(MAX_METRICS_DATA_POINTS - timestamps.length).fill(null)];

      acc[`${key}_${valueKey}`] = {
        labels,
        datasets: [
          {
            data,
            backgroundColor: (context) => {
              const value = context.raw as number;
              if (value >= 90) return '#FA5252';
              if (value >= 70) return '#FF9966';
              return '#df2a4c';
            },
            borderWidth: 0,
            borderRadius: 3,
            barPercentage: 0.8,
            categoryPercentage: 0.8,
            maxBarThickness: 4,
            barThickness: 4,
          },
        ],
      };
    });

    return acc;
  }, {});
}

function onPage(e: { page: number; rows: number; first: number }, type: 'frameworker' | 'plugins') {
  tablePages.value[type] = e.page + 1;
}

function getStatus(type: 'system' | 'core' | 'frameworker' | 'plugins', name: string): RUNTIME_STATUS | PLUGIN_STATUS {
  if (type === 'core') {
    switch (name) {
      case 'camera.ui':
        return serverStatus.value;
      case 'go2rtc':
        return go2rtcStatus.value;
      case 'nats':
        return natsStatus.value;
      default:
        return RUNTIME_STATUS.UNKNOWN;
    }
  } else if (type === 'frameworker') {
    return frameWorkerStatus.value[name]?.status ?? PLUGIN_STATUS.UNKNOWN;
  } else if (type === 'plugins') {
    return pluginsStatus.value[name]?.status ?? PLUGIN_STATUS.UNKNOWN;
  }

  return RUNTIME_STATUS.UNKNOWN;
}

function getStatusColor(status: RUNTIME_STATUS | PLUGIN_STATUS): string {
  switch (status) {
    case PLUGIN_STATUS.ERROR:
    case RUNTIME_STATUS.ERROR:
      return '#9d5752';
    case RUNTIME_STATUS.STOPPED:
    case PLUGIN_STATUS.STOPPED:
    case PLUGIN_STATUS.STOPPING:
      return 'red';
    case PLUGIN_STATUS.READY:
    case RUNTIME_STATUS.READY:
      return 'yellow';
    case PLUGIN_STATUS.STARTING:
    case RUNTIME_STATUS.STARTING:
      return 'orange';
    case PLUGIN_STATUS.STARTED:
    case RUNTIME_STATUS.STARTED:
      return 'green';
    case PLUGIN_STATUS.UNKNOWN:
    case PLUGIN_STATUS.DISABLED:
    case RUNTIME_STATUS.UNKNOWN:
      return 'gray';
    default:
      return 'gray';
  }
}

function getStatusText(status: RUNTIME_STATUS | PLUGIN_STATUS): string {
  switch (status) {
    case PLUGIN_STATUS.ERROR:
    case RUNTIME_STATUS.ERROR:
      return t('components.process_table.status_error');
    case PLUGIN_STATUS.STOPPED:
    case RUNTIME_STATUS.STOPPED:
      return t('components.process_table.status_stopped');
    case PLUGIN_STATUS.STOPPING:
      return t('components.process_table.status_stopping');
    case PLUGIN_STATUS.READY:
    case RUNTIME_STATUS.READY:
      return t('components.process_table.status_ready');
    case PLUGIN_STATUS.STARTING:
    case RUNTIME_STATUS.STARTING:
      return t('components.process_table.status_starting');
    case PLUGIN_STATUS.STARTED:
    case RUNTIME_STATUS.STARTED:
      return t('components.process_table.status_started');
    case PLUGIN_STATUS.DISABLED:
      return t('components.process_table.status_disabled');
    case PLUGIN_STATUS.UNKNOWN:
    case RUNTIME_STATUS.UNKNOWN:
      return t('components.process_table.status_unknown');
    default:
      return t('components.process_table.status_unknown');
  }
}

async function coreRestart(target: 'camera.ui' | 'go2rtc'): Promise<void> {
  if (target === 'camera.ui') {
    beginServerRestart();
    restartServer();
  } else if (target === 'go2rtc') {
    restartGo2Rtc();
  }
}

async function frameWorkerRestart(frameWorkerName: string): Promise<void> {
  frameWorkersRestarting.value.push(frameWorkerName);
  try {
    await restartFrameWorker({ frameWorkerName });
  } catch {
    // Error surfaces via the mutation's observer-level handlers (toast, etc.)
  } finally {
    frameWorkersRestarting.value = frameWorkersRestarting.value.filter((frameWorker) => frameWorker !== frameWorkerName);
  }
}

async function pluginRestart(pluginName: string): Promise<void> {
  pluginsRestarting.value.push(pluginName);
  try {
    await restartPlugin({ pluginName });
  } catch {
    // Error surfaces via the mutation's observer-level handlers (toast, etc.)
  } finally {
    pluginsRestarting.value = pluginsRestarting.value.filter((plugin) => plugin !== pluginName);
  }
}

function formatGB(gb: number): string {
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(gb * 1000).toFixed(0)} MB`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

function formatRate(mbPerHour: number): string {
  const gbPerDay = (mbPerHour * 24) / 1000;
  if (gbPerDay >= 1) return `${gbPerDay.toFixed(1)} GB/d`;
  return `${(gbPerDay * 1000).toFixed(0)} MB/d`;
}

watch(
  frameWorkersProcessInfos,
  (newValues) => {
    for (const [name, processInfo] of Object.entries(newValues)) {
      frameWorkersProcess.value[name] = processInfo[processInfo.length - 1] ?? {
        ...DEFAULT_PROCESS_LOAD,
        name,
        type: 'frameworker',
      };
    }
  },
  { deep: true, immediate: true },
);

watch(
  pluginsProcessInfos,
  (newValues) => {
    for (const [name, processInfo] of Object.entries(newValues)) {
      pluginsProcesses.value[name] = processInfo[processInfo.length - 1] ?? {
        ...DEFAULT_PROCESS_LOAD,
        name,
        type: 'plugin',
      };
    }
  },
  { deep: true, immediate: true },
);

watch(
  frameWorkers,
  (workers) => {
    if (workers) {
      for (const frameWorker of workers.result) {
        if (!frameWorkersProcessInfos.value[frameWorker.name]) {
          frameWorkersProcessInfos.value[frameWorker.name] = [];
        }
        if (!frameWorkerStatus.value[frameWorker.name]) {
          frameWorkerStatus.value[frameWorker.name] = {
            name: frameWorker.name,
            status: PLUGIN_STATUS.UNKNOWN,
          };
        }
      }
    }
  },
  { deep: true, immediate: true },
);

watch(
  plugins,
  (workers) => {
    if (workers) {
      for (const plugin of workers.result) {
        if (plugin.disabled) continue;
        if (!pluginsProcessInfos.value[plugin.pluginName]) {
          pluginsProcessInfos.value[plugin.pluginName] = [];
        }
        if (!pluginsStatus.value[plugin.pluginName]) {
          pluginsStatus.value[plugin.pluginName] = {
            name: plugin.pluginName,
            status: PLUGIN_STATUS.UNKNOWN,
          };
        }
      }
    }
  },
  { deep: true, immediate: true },
);

onBeforeMount(async () => {
  metricsSocket.connect();

  await Promise.all([pluginsSuspense(), frameWorkerSuspense()]);
  await new Promise((resolve) => setTimeout(resolve, 10));

  metricsSocket.loadAll();
});

onUnmounted(() => {
  metricsSocket.disconnect();
});
</script>

<style scoped>
.metrics-tabs :deep(.p-tablist),
.metrics-tabs :deep(.p-tablist-content) {
  background: transparent;
}

.metrics-tabs :deep(.p-tablist-tab-list) {
  background: var(--p-card-background);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 0.375rem;
  gap: 0.25rem;
}

.metrics-tabs :deep(.p-tab) {
  padding: 0.5rem 1rem;
  margin: 0;
  border-width: 0;
  border-radius: 0.5rem;
}

.metrics-tabs :deep(.p-tab-active) {
  background: var(--p-content-hover-background);
}

.metrics-tabs :deep(.p-tablist-active-bar) {
  display: none;
}
</style>
