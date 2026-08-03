<template>
  <Badge
    v-tooltip.top="{ value: $t(`components.plugin_card.status_${pluginsSocket.status.value}`) }"
    :style="{
      background: pluginsSocket.statusColor.value,
    }"
  ></Badge>
</template>

<script setup lang="ts">
const props = defineProps<{ pluginName: string }>();

const pluginsSocket = usePluginsSocket(props.pluginName);

onBeforeMount(() => {
  pluginsSocket.connect();
});
</script>

<style scoped></style>
