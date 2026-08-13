<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col field-gap">
      <label class="cui-label">{{ t('components.automation_nodes.notification_control_mode') }}</label>
      <Select
        :model-value="data.mode ?? 'disable'"
        :options="modeOptions"
        option-label="label"
        option-value="value"
        class="w-full"
        @update:model-value="update('mode', $event)"
      />
    </div>

    <div class="flex flex-col field-gap">
      <label class="cui-label">{{ t('components.automation_nodes.notification_control_scope') }}</label>
      <Select
        :model-value="data.scope ?? 'global'"
        :options="scopeOptions"
        option-label="label"
        option-value="value"
        class="w-full"
        @update:model-value="update('scope', $event)"
      />
      <Message severity="secondary" variant="simple" size="small" class="cui-input-hint">{{ scopeHint }}</Message>
    </div>

    <div v-if="data.scope === 'user'" class="flex flex-col field-gap">
      <label class="cui-label">{{ t('components.automation_nodes.notification_control_user') }}</label>
      <Select
        :model-value="data.userId ?? ''"
        :options="userOptions"
        option-label="label"
        option-value="value"
        :loading="usersLoading"
        :placeholder="t('components.automation_nodes.notification_control_user_placeholder')"
        filter
        class="w-full"
        @update:model-value="update('userId', $event)"
      />
    </div>

    <div v-if="data.scope === 'camera'" class="flex flex-col field-gap">
      <label class="cui-label">{{ t('components.automation_nodes.notification_control_camera') }}</label>
      <Select
        :model-value="data.cameraId ?? ''"
        :options="cameraOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('components.automation_nodes.camera_select')"
        filter
        class="w-full"
        @update:model-value="update('cameraId', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UsersQuery } from '@/api/routes/users.js';

import { useCameraOptions } from './useCameraOptions.js';

import type { ConfigActionNotificationControlProps, ConfigNodeUpdateEmits } from '../types.js';

const usersQuery = new UsersQuery();

const props = defineProps<ConfigActionNotificationControlProps>();
const emit = defineEmits<ConfigNodeUpdateEmits>();

const { t } = useI18n();
const { cameraOptions } = useCameraOptions();
const { data: users, isLoading: usersLoading } = usersQuery.getUsersQuery({ pageSize: 1000 });

const modeOptions = [
  { label: t('components.automation_nodes.notification_control_enable'), value: 'enable' },
  { label: t('components.automation_nodes.notification_control_disable'), value: 'disable' },
];
const scopeOptions = [
  { label: t('components.automation_nodes.notification_control_scope_global'), value: 'global' },
  { label: t('components.automation_nodes.notification_control_scope_camera'), value: 'camera' },
  { label: t('components.automation_nodes.notification_control_scope_user'), value: 'user' },
];

const userOptions = computed(() => (users.value?.result ?? []).map((u) => ({ value: u._id, label: u.username })));
const scopeHint = computed(() => {
  if (props.data.scope === 'user') return t('components.automation_nodes.notification_control_scope_user_hint');
  if (props.data.scope === 'camera') return t('components.automation_nodes.notification_control_scope_camera_hint');
  return t('components.automation_nodes.notification_control_scope_global_hint');
});

function update(key: string, value: unknown) {
  emit('update:data', { [key]: value });
}
</script>
