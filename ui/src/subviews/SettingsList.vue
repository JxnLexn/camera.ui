<template>
  <div>
    <CuiList size="large" dividers class="!h-auto">
      <CuiListItem v-for="item in items" :key="item.to" :to="item.to">
        <template #prepend>
          <component :is="item.icon" class="w-5 h-5 text-muted" />
        </template>
        {{ item.label }}
        <template #append>
          <i-mdi:chevron-right class="w-5 h-5 text-muted" />
        </template>
      </CuiListItem>
    </CuiList>
  </div>
</template>

<script setup lang="ts">
import { routes } from '@/router/index.js';

const { t } = useI18n();

const items = computed(() =>
  routes
    .find((route) => route.name === 'Settings')!
    .children!.filter((route) => route.meta?.settingsBar && hasPermission(route))
    .map((route) => ({
      to: `/settings/${route.path}`,
      label: t(`navigation.${(route.meta!.name as string).toLowerCase()}`),
      icon: route.meta!.settingsBar!.icon.default,
    })),
);
</script>
