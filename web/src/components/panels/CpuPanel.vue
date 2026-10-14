<script setup lang="ts">
import { ref, computed } from 'vue';
import { format } from '../../lib/core';
import { cpu as draw } from '../../lib/charts';
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
const historyLabel = computed(() =>
  props.samples.length > 1
    ? 'SESSION / ' + props.samples.length + ' SAMPLES'
    : 'SESSION / WAITING FOR SAMPLES',
);
</script>

<template>
  <article class="cpu-panel panel">
    <div class="panel-heading">
      <h2 class="color-cyan">
        CPU
        <span id="selected-load">
          {{ 'LOAD ' + node.loadText }}
        </span>
      </h2>
      <strong id="selected-cpu" class="color-cyan">
        {{ format.percent(node.cpuUsage) }}
      </strong>
    </div>
    <div class="cpu-plot">
      <canvas
        id="cpu-chart"
        role="img"
        aria-label="CPU utilization samples from this page session"
        ref="canvas"
      ></canvas>
      <div class="cpu-scale" aria-hidden="true">
        <span>100</span>
        <span>50</span>
        <span>0</span>
      </div>
    </div>
    <div class="plot-caption">
      <span id="cpu-history-label">{{ historyLabel }}</span>
      <span>AGGREGATE CPU · NOT PER CORE</span>
    </div>
  </article>
</template>
