<script setup lang="ts">
import { computed } from 'vue';
import { format } from '../lib/core';
import { useDialog } from '../composables/useDialog';
import DevicePanel from './panels/DevicePanel.vue';
import CpuPanel from './panels/CpuPanel.vue';
import MemoryPanel from './panels/MemoryPanel.vue';
import NetworkPanel from './panels/NetworkPanel.vue';
import DiskPanel from './panels/DiskPanel.vue';
import PingPanel from './panels/PingPanel.vue';
import type { NodeView, HistorySample, Theme } from '../types';

const props = defineProps<{
  selectedNode: NodeView | undefined;
  nodes: NodeView[];
  selectedPosition: string;
  samples: HistorySample[];
  theme: Theme;
  isPreviousReport: boolean;
}>();
const emit = defineEmits<{
  close: [];
  step: [offset: number];
  'focus-fallback': [];
}>();

const { close, closeOutside, onClose } = useDialog(
  () => !!props.selectedNode,
  () => emit('close'),
  { lockScroll: true, fallback: () => emit('focus-fallback') },
);
const selectedStatus = computed(() =>
  props.isPreviousReport
    ? 'LAST REPORT'
    : props.selectedNode?.active
      ? 'ONLINE'
      : 'OFFLINE',
);
</script>

<template>
  <dialog
    id="node-dialog"
    class="node-drawer"
    aria-labelledby="selected-heading"
    ref="dialog"
    @click="closeOutside"
    @close="onClose"
  >
    <section
      id="console"
      class="console"
      aria-label="Selected node instruments"
      v-if="selectedNode"
      :class="{ 'node-offline': !selectedNode.active }"
    >
      <div class="console-title">
        <div>
          <span class="eyebrow">INSPECTING</span>
          <span id="selected-heading">{{ selectedNode.displayName }}</span>
        </div>
        <div class="node-switcher">
          <span id="selected-position">
            {{ selectedPosition + ' / ' + format.count(nodes.length) }}
          </span>
          <button
            id="previous-node"
            aria-label="Previous node"
            :disabled="nodes.length < 2"
            @click="$emit('step', -1)"
          >
            PREV
          </button>
          <button
            id="next-node"
            aria-label="Next node"
            :disabled="nodes.length < 2"
            @click="$emit('step', 1)"
          >
            NEXT
          </button>
          <button
            id="node-close"
            aria-label="Close node details and return to fleet"
            autofocus
            @click="close()"
          >
            <span class="desktop-close">CLOSE</span>
            <span class="mobile-close">BACK</span>
          </button>
        </div>
      </div>
      <div class="instrument-grid">
        <DevicePanel :node="selectedNode" :selected-status="selectedStatus" />
        <CpuPanel :node="selectedNode" :samples="samples" :theme="theme" />
        <MemoryPanel :node="selectedNode" />
        <NetworkPanel :node="selectedNode" :samples="samples" :theme="theme" />
        <DiskPanel :node="selectedNode" />
        <PingPanel :node="selectedNode" />
      </div>
      <div class="console-bottom">
        <span id="selected-node-id">
          {{ 'NODE / ' + selectedNode.name }}
        </span>
        <span id="selected-spec">{{ selectedNode.spec }}</span>
        <span id="selected-report">
          {{ 'REPORT / ' + format.time(selectedNode.latest_ts) }}
        </span>
      </div>
      <div
        id="selected-extra"
        class="extra-labels"
        v-if="selectedNode.extra.length"
      >
        <span v-for="item in selectedNode.extra" :key="item.label">
          {{ item.label }} /
          <b>{{ item.value }}</b>
        </span>
      </div>
    </section>
  </dialog>
</template>
