<script setup lang="ts">
import { ref } from 'vue';
import { network as draw } from '../../lib/charts';
import { useChart } from '../../composables/useChart';
import type { NodeView, HistorySample, Theme } from '../../types';

const props = defineProps<{
  node: NodeView;
  samples: HistorySample[];
  theme: Theme;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
useChart(
  canvas,
  () => props.samples,
  () => props.theme,
  draw,
);
</script>

<template>
  <article class="network-panel panel">
    <div class="panel-heading">
      <h2 class="color-purple">
        NET
        <span>SESSION TRAFFIC</span>
      </h2>
      <span class="rate-values">
        <b id="selected-rx" class="color-purple">
          {{ 'RX ' + node.receiveRate }}
        </b>
        <b id="selected-tx" class="color-blue">
          {{ 'TX ' + node.transmitRate }}
        </b>
      </span>
    </div>
    <canvas
      id="network-chart"
      role="img"
      aria-label="Receive and transmit rates sampled during this page session"
      ref="canvas"
    ></canvas>
    <div class="network-totals">
      <span>
        TOTAL
        <b id="total-traffic">{{ node.totalTraffic }}</b>
      </span>
      <span>
        MONTH
        <b id="month-traffic">{{ node.monthTraffic }}</b>
      </span>
    </div>
  </article>
</template>
