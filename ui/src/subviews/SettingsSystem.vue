<template>
  <div>
    <div class="flex flex-col w-full gap-6">
      <div>
        <Card class="cui-card">
          <template #content>
            <div>
              <div class="flex items-center gap-4">
                <div class="flex flex-col field-switch-gap">
                  <label for="betaChannel" class="cui-label-switch">{{ $t('views.settings.beta_updates') }}</label>
                  <Message severity="secondary" variant="simple" size="small" class="cui-input-switch-hint">
                    {{ $t('views.settings.beta_updates_info') }}
                  </Message>
                </div>
                <ToggleSwitch input-id="betaChannel" :model-value="isBeta" class="ml-auto shrink-0" @update:model-value="onBetaToggle" />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <div>
        <span class="card-title">camera.ui</span>
        <Card class="cui-card">
          <template #content>
            <div class="flex flex-col gap-6">
              <div v-if="isElectronApp" class="flex flex-row items-center justify-between">
                <span class="text-sm">{{ $t('views.settings.app') }}</span>
                <ProgressSpinner v-if="isLoading" class="w-[15px] h-[15px] m-0" stroke-width="5" />
                <span v-else class="text-sm font-bold">v{{ currentElectronVersion }}</span>
              </div>

              <div v-if="isCapacitor && appVersion" class="flex flex-row items-center justify-between">
                <span class="text-sm">{{ $t('views.settings.app') }}</span>
                <span class="text-sm font-bold">
                  v{{ appVersion }}<span v-if="nativeVersion && nativeVersion !== appVersion" class="text-muted font-normal"> ({{ nativeVersion }})</span>
                </span>
              </div>

              <div class="flex flex-row items-center justify-between">
                <span class="text-sm">{{ $t('views.settings.server') }}</span>
                <ProgressSpinner v-if="isLoading" class="w-[15px] h-[15px] m-0" stroke-width="5" />
                <span v-else class="text-sm font-bold">
                  v{{ currentVersion }}<template v-if="restartRequired"> &rarr; v{{ installedVersion }}</template>
                </span>
              </div>

              <div v-if="!isElectronBuild" class="flex w-full items-center gap-2">
                <div class="ml-auto"></div>

                <Button
                  v-if="restartRequired"
                  :loading="isLoading"
                  :disabled="actionsDisabled"
                  class="cui-button-medium"
                  :label="`${$t('components.form.button.restart')} (v${installedVersion})`"
                  @click="openDialog('restart')"
                />

                <Button
                  :loading="isLoading"
                  :disabled="actionsDisabled"
                  class="cui-button-medium"
                  :label="$t('components.form.button.manage')"
                  @click="openDialog('versions')"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <div v-if="!isElectronApp">
        <span class="card-title">{{ $t('views.settings.certificate') }}</span>
        <Card class="cui-card">
          <template #content>
            <div class="flex flex-col gap-6">
              <span class="text-sm">{{ $t('views.settings.certificate_info') }}</span>
              <Button
                :loading="loadingCert || isLoading"
                :disabled="actionsDisabled"
                class="cui-button-medium ml-auto"
                :label="$t('components.form.button.download')"
                @click="downloadCert"
              />
            </div>
          </template>
        </Card>
      </div>

      <div>
        <span class="card-title">{{ $t('views.settings.restart_server') }}</span>
        <Card class="cui-card">
          <template #content>
            <div class="flex flex-col gap-6">
              <span class="text-sm">{{ $t('views.settings.restart_server_info') }}</span>
              <Button
                :loading="isLoading"
                :disabled="actionsDisabled"
                class="cui-button-medium ml-auto"
                :label="$t('components.form.button.restart')"
                @click="openDialog('restart')"
              />
            </div>
          </template>
        </Card>
      </div>

      <div v-if="hasPermission(undefined, 'master')">
        <span class="card-title">{{ $t('views.settings.reset_server') }}</span>
        <Card class="cui-card !border-red-900">
          <template #content>
            <div class="flex flex-col gap-6">
              <span class="text-sm">{{ $t('views.settings.reset_server_info') }}</span>
              <Button
                :loading="isLoading"
                :disabled="actionsDisabled"
                class="cui-button-medium ml-auto"
                :label="$t('components.form.button.reset')"
                @click="openDialog('reset')"
              />
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ApiQuery, apiInfo as fetchApiInfo } from '@/api/routes/api.js';
import { downloadCertFn, ServerQuery } from '@/api/routes/server.js';
import { asyncComponent } from '@/common/asyncComponent.js';
import { isCapacitor } from '@/connection/index.js';

import type { VersionsHandlerProps } from '@/components/CuiDialog/templates/VersionsHandler/types.js';

const VersionsHandlerDialog = asyncComponent(() => import('@/components/CuiDialog/templates/VersionsHandler/VersionsHandler.vue'));

const apiQuery = new ApiQuery();
const serverQuery = new ServerQuery();

const log = useLogger();
const dialog = useCuiDialog();
const { t } = useI18n();
const { isElectronApp, electron } = useElectron();
const { isOnline } = useConnection();
const { restarting, beginServerRestart } = useServerRestart();
const { isBeta, setBeta } = useUpdateChannel();
const { appVersion, nativeVersion, refreshAppVersion } = useAppVersion();

const authStore = useAuthStore();

const { data: apiInfo, isBusy: apiInfoLoading } = apiQuery.apiInfoQuery();
const { mutate: restartServer, isPending: restartServerLoading } = serverQuery.restartServerQuery();
const { mutateAsync: resetServer, isPending: resetServerLoading } = serverQuery.resetServerQuery();

const currentVersion = ref(t('views.settings.unknown'));
const currentElectronVersion = ref(t('views.settings.unknown'));
const loadingCert = ref(false);

let refreshRun = 0;

const isElectronBuild = computed(() => apiInfo.value?.electron ?? false);

const isLoading = computed(() => {
  return restartServerLoading.value || resetServerLoading.value || apiInfoLoading.value;
});

const installedVersion = computed(() => apiInfo.value?.installedVersion || apiInfo.value?.version);

const restartRequired = computed(() => apiInfo.value?.restartRequired ?? false);

const actionsDisabled = computed(() => isLoading.value || !isOnline.value || restarting.value);

function onBetaToggle(next: boolean | string | undefined): void {
  setBeta(next === true);
}

async function downloadCert(): Promise<void> {
  if (loadingCert.value) {
    return;
  }

  loadingCert.value = true;

  try {
    const response = await downloadCertFn();
    const blob = new Blob([response], { type: 'application/x-x509-ca-cert' });
    await download({ blob, filename: 'cert.pem', mimeType: 'application/x-x509-ca-cert' });
  } catch (err) {
    log.error(err);
  }

  loadingCert.value = false;
}

function beginRestart(): void {
  beginServerRestart();
  restartServer();
}

function openDialog(type: 'restart' | 'reset' | 'versions') {
  switch (type) {
    case 'restart':
      dialog.openTextDialog({
        data: {
          title: t('components.dialog.title.restart'),
          confirmText: t('components.form.button.restart'),
          contentText: t('components.dialog.message.confirm_restart_server'),
          loading: isLoading,
        },
        onConfirm: beginRestart,
      });
      break;
    case 'reset':
      dialog.openTextDialog({
        data: {
          title: t('components.dialog.title.reset_server'),
          confirmText: t('components.form.button.reset'),
          contentText: t('components.dialog.message.confirm_reset_server'),
          loading: isLoading,
        },
        onConfirm: async () => {
          try {
            await resetServer();
          } catch {
            //
          } finally {
            authStore.logout();
          }
        },
      });
      break;
    case 'versions':
      dialog.openComponentDialog<VersionsHandlerProps>(VersionsHandlerDialog, {
        data: {
          title: t('components.dialog.title.install_version'),
          confirmText: t('components.form.button.install'),
          loading: isLoading,
          contentProps: {
            target: { type: 'server' },
          },
        },
      });
      break;
  }
}

async function checkElectronVersion() {
  if (!isElectronApp) {
    return;
  }

  try {
    currentElectronVersion.value = (await electron!.invoke('get-app-version')) ?? t('views.settings.unknown');
  } catch (error) {
    log.error('Error getting electron app version:', error);
  }
}

async function refreshAfterReconnect(): Promise<void> {
  const run = ++refreshRun;

  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await fetchApiInfo({ signal: AbortSignal.timeout(5000) });
      if (run !== refreshRun) return;
      apiQuery.queryClient.invalidateQueries({ queryKey: ['api'] });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (run !== refreshRun || !isOnline.value) return;
    }
  }
}

watch(
  apiInfo,
  () => {
    currentVersion.value = apiInfo.value?.version || t('views.settings.unknown');
  },
  { deep: true, immediate: true },
);

watch([isOnline, restarting], ([online, restart], [wasOnline, wasRestart]) => {
  if (isElectronBuild.value) return;

  const reconnected = online && !wasOnline;
  const restartEnded = wasRestart && !restart && online;

  if (reconnected || restartEnded) {
    refreshAfterReconnect();
  }
});

onBeforeUnmount(() => {
  refreshRun++;
});

onMounted(() => {
  if (isCapacitor) {
    refreshAppVersion();
  }
  if (isElectronApp) {
    checkElectronVersion();
  }
});
</script>

<style scoped></style>
