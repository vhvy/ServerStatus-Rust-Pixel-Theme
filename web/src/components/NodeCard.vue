<script setup lang="ts">
import { ref } from 'vue';
import { format } from '../lib/core';
import type { NodeView } from '../types';

defineProps<{ node: NodeView; index: number; selected: boolean }>();
defineEmits<{ inspect: [name: string]; 'focus-offset': [offset: number] }>();

const button = ref<HTMLButtonElement | null>(null);
defineExpose({ focus: () => button.value?.focus() });
</script>

<template>
  <button
    ref="button"
    type="button"
    class="node-card"
    :class="{ selected: selected, 'is-offline': !node.active }"
    :data-node="node.name"
    aria-haspopup="dialog"
    aria-controls="node-dialog"
    :aria-label="
      node.displayName +
      ', ' +
      (node.active ? 'online' : 'offline') +
      ', inspect node'
    "
    @click="$emit('inspect', node.name)"
    @keydown.left.prevent="$emit('focus-offset', -1)"
    @keydown.right.prevent="$emit('focus-offset', 1)"
  >
    <span class="card-top">
      <span class="card-status">
        <i class="status-dot" :class="{ offline: !node.active }"></i>
        {{ node.active ? 'ONLINE' : 'OFFLINE' }}
      </span>
      <span class="card-location">
        {{ node.locationCode }} / {{ format.count(index + 1) }}
      </span>
    </span>
    <span class="card-body">
      <img class="card-art" :src="node.art" width="72" height="54" alt="" />
      <span>
        <span class="card-name">{{ node.displayName }}</span>
        <span class="card-type">{{ node.platform }}</span>
      </span>
    </span>
    <span class="card-meters">
      <span v-for="metric in node.metrics" :key="metric.kind">
        <span class="card-meter-label">
          {{ metric.label }}
          <b :class="{ warning: metric.value !== null && metric.value >= 85 }">
            {{ format.percent(metric.value) }}
          </b>
        </span>
        <span
          class="mini-meter"
          :class="metric.kind"
          :style="{ '--fill': (metric.value ?? 0) + '%' }"
          aria-hidden="true"
        >
          <i></i>
        </span>
      </span>
    </span>
    <span class="card-footer">
      <span class="card-uptime">
        UP {{ node.active ? node.uptimeText : '--' }}
      </span>
      <span class="color-purple">RX {{ node.receiveRate }}</span>
      <span class="color-blue">TX {{ node.transmitRate }}</span>
    </span>
  </button>
</template>
