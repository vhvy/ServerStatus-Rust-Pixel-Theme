<script setup lang="ts">
import { computed, ref } from 'vue';
import { useChart } from '../../composables/useChart';
import { ping, pingScale, pingSeries } from '../../lib/charts';
import type { PingHistoryPoint, Theme } from '../../types';

const props = defineProps<{
  points: PingHistoryPoint[];
  loading: boolean;
  theme: Theme;
}>();
const canvas = ref<HTMLCanvasElement | null>(null);
const maximum = computed(() => pingScale(props.points));
const clock = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const times = computed(() => {
  if (!props.points.length) return [];
  const start = props.points[0].t;
  const end = props.points[props.points.length - 1].t;
  return (start === end ? [start] : [start, (start + end) / 2, end]).map(
    (time) => clock.format(time * 1000),
  );
});
useChart(
  canvas,
  () => props.points,
  () => props.theme,
  ping,
);
</script>

<template>
  <article class="panel ping-history-panel">
    <div class="panel-heading">
      <h2 class="color-green">PING HISTORY</h2>
      <span>RTT / ms</span>
    </div>
    <p v-if="!points.length" class="ping-history-empty" role="status">
      {{ loading ? 'LOADING HISTORY…' : 'NO HISTORY AVAILABLE' }}
    </p>
    <div v-show="points.length" class="ping-history-chart">
      <div class="ping-history-legend" aria-label="Carriers">
        <span
          v-for="[carrier, color] in pingSeries"
          :key="carrier"
          :style="{ color: 'var(' + color + ')' }"
        >
          {{ carrier.toUpperCase() }}
        </span>
      </div>
      <div class="ping-history-axis">
        <span>{{ maximum }}</span>
        <span>{{ maximum / 2 }}</span>
        <span>0</span>
      </div>
      <canvas
        ref="canvas"
        role="img"
        aria-label="Unicom, Telecom and Mobile latency in milliseconds over time. Gaps indicate unavailable probes."
      ></canvas>
      <div
        class="ping-history-time"
        :class="{ 'single-point': times.length === 1 }"
      >
        <span v-for="(time, index) in times" :key="index">{{ time }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.ping-history-panel {
  grid-column: 1 / -1;
}
.ping-history-chart {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 8px;
  color: var(--muted);
  font-size: 11px;
}
.ping-history-legend,
.ping-history-time {
  grid-column: 2;
  display: flex;
}
.ping-history-legend {
  gap: 14px;
}
.ping-history-time {
  justify-content: space-between;
}
.single-point {
  justify-content: center;
}
.ping-history-axis {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
}
.ping-history-chart canvas {
  display: block;
  width: 100%;
  height: clamp(148px, 18vw, 184px);
}
.ping-history-empty {
  color: var(--muted);
  font-size: 11px;
}
</style>
