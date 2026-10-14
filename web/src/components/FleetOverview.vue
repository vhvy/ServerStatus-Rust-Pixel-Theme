<script setup lang="ts">
import { computed } from 'vue';
import { format } from '../lib/core';
import type { StatsPayload, NodeView, FleetSummary } from '../types';

const props = defineProps<{
  payload: StatsPayload | null;
  nodes: NodeView[];
  fleet: FleetSummary;
  onlineSummary: string;
}>();

function splitRate(value: number | null) {
  const [amount, unit = ''] = format.rate(value).split(' ');
  return { amount, unit };
}
const receiveRate = computed(() => splitRate(props.fleet.rx));
const transmitRate = computed(() => splitRate(props.fleet.tx));
</script>

<template>
  <section class="fleet-overview" aria-label="Fleet summary">
    <div class="overview-item">
      <span class="eyebrow">FLEET</span>
      <strong id="fleet-count">
        {{ payload ? format.count(nodes.length) : '--' }}
      </strong>
      <span id="online-summary">{{ onlineSummary }}</span>
    </div>
    <div class="overview-item">
      <span class="eyebrow">AVG CPU</span>
      <strong id="fleet-cpu">{{ format.percent(fleet.cpu) }}</strong>
    </div>
    <div class="overview-item">
      <span class="eyebrow">MEMORY</span>
      <strong id="fleet-memory">
        {{ format.percent(fleet.memory) }}
      </strong>
    </div>
    <div class="overview-item overview-network">
      <span class="eyebrow">NETWORK</span>
      <span>
        <b class="color-purple">RX</b>
        <strong id="fleet-rx">
          <span class="network-number">{{ receiveRate.amount }}</span>
          <span class="network-unit">{{ receiveRate.unit }}</span>
        </strong>
        <b class="color-blue">TX</b>
        <strong id="fleet-tx">
          <span class="network-number">{{ transmitRate.amount }}</span>
          <span class="network-unit">{{ transmitRate.unit }}</span>
        </strong>
      </span>
    </div>
  </section>
</template>
