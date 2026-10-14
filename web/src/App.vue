<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { format } from './lib/core';
import { useTelemetry } from './composables/useTelemetry';
import { useTheme } from './composables/useTheme';
import SiteHeader from './components/SiteHeader.vue';
import FleetOverview from './components/FleetOverview.vue';
import ConnectionStatus from './components/ConnectionStatus.vue';
import FleetList from './components/FleetList.vue';
import NodeDetails from './components/NodeDetails.vue';
import AboutDialog from './components/AboutDialog.vue';
import type { ThemeConfig } from './types';

const props = defineProps<{ config: ThemeConfig }>();

const telemetry = useTelemetry(props.config);
const {
  payload,
  loading,
  now,
  nodes,
  fleet,
  isPreviousReport,
  onlineSummary,
  lastUpdate,
  connectionText,
  warning,
  emptyState,
  refresh,
} = telemetry;
const { theme, toggleTheme } = useTheme(props.config.defaultTheme);
const selectedName = ref('');
const aboutOpen = ref(false);
const fleetList = ref<InstanceType<typeof FleetList> | null>(null);
const selectedNode = computed(() =>
  telemetry.nodes.value.find((node) => node.name === selectedName.value),
);
const samples = computed(
  () => telemetry.histories.value.get(selectedName.value) || [],
);
const selectedPosition = computed(() =>
  format.count(
    telemetry.nodes.value.findIndex(
      (node) => node.name === selectedName.value,
    ) + 1,
  ),
);
watch(selectedNode, (node) => {
  if (!node) selectedName.value = '';
});
function stepNode(offset: number) {
  const nodes = telemetry.nodes.value;
  if (!nodes.length) return;
  const index = nodes.findIndex((node) => node.name === selectedName.value);
  selectedName.value =
    nodes[(index + offset + nodes.length) % nodes.length].name;
}
</script>

<template>
  <a class="skip-link" href="#fleet">Skip to fleet</a>
  <SiteHeader
    :title="config.title"
    :now="now"
    :theme="theme"
    @toggle-theme="toggleTheme"
    @about="aboutOpen = true"
  />
  <main class="shell" :class="{ 'timestamp-delayed': isPreviousReport }">
    <FleetOverview
      :payload="payload"
      :nodes="nodes"
      :fleet="fleet"
      :online-summary="onlineSummary"
    />
    <ConnectionStatus
      :payload="payload"
      :is-previous-report="isPreviousReport"
      :connection-text="connectionText"
      :last-update="lastUpdate"
      :config="config"
      :loading="loading"
      :warning="warning"
      @refresh="refresh"
    />
    <NodeDetails
      :selected-node="selectedNode"
      :nodes="nodes"
      :selected-position="selectedPosition"
      :samples="samples"
      :theme="theme"
      :is-previous-report="isPreviousReport"
      @step="stepNode"
      @close="selectedName = ''"
      @focus-fallback="fleetList?.focusSearch()"
    />
    <FleetList
      ref="fleetList"
      :nodes="nodes"
      :payload="payload"
      :fleet="fleet"
      :loading="loading"
      :empty-state="emptyState"
      :selected-name="selectedName"
      @inspect="selectedName = $event"
    />
    <footer>
      <span>
        PIXEL / STATUS
        <b>V2.0</b>
      </span>
      <span>SMALL PIXELS. BIG PICTURE.</span>
      <a
        href="https://github.com/zdz/ServerStatus-Rust"
        target="_blank"
        rel="noopener noreferrer"
      >
        SERVERSTATUS-RUST / SOURCE
      </a>
    </footer>
  </main>
  <AboutDialog :open="aboutOpen" @close="aboutOpen = false" />
</template>
