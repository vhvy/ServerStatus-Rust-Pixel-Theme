<script setup lang="ts">
import { computed, ref } from 'vue';
import { useChart } from '../../composables/useChart';
import {
  nearestPingPoint,
  ping,
  pingPlotInset,
  pingScale,
  pingSeries,
  pingTimeFraction,
} from '../../lib/charts';
import type { PingHistoryPoint, Theme } from '../../types';

const props = defineProps<{
  points: PingHistoryPoint[];
  loading: boolean;
  theme: Theme;
}>();
const canvas = ref<HTMLCanvasElement | null>(null);
const cursorTime = ref<number>();
const maximum = computed(() => pingScale(props.points));
const start = computed(() => props.points[0]?.t ?? 0);
const end = computed(() => props.points.at(-1)?.t ?? 0);
const clock = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const times = computed(() => {
  if (!props.points.length) return [];
  const from = start.value;
  const to = end.value;
  return (from === to ? [from] : [from, (from + to) / 2, to]).map((time) =>
    clock.format(time * 1000),
  );
});
const sampleClock = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const milliseconds = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 2,
  useGrouping: false,
});
const sampleIndex = computed(() =>
  nearestPingPoint(props.points, cursorTime.value ?? end.value),
);
const sample = computed(() => props.points[sampleIndex.value]);
const sampleDate = computed(() =>
  sample.value ? sampleClock.format(sample.value.t * 1000) : '',
);
const reading = computed(() =>
  sample.value
    ? pingSeries.map(([key, color]) => {
        const value = sample.value![key];
        return {
          key,
          color: `var(${color})`,
          value,
          text: value === null ? '—' : `${milliseconds.format(value)} ms`,
        };
      })
    : [],
);
const sampleX = computed(
  () => pingTimeFraction(sample.value?.t ?? 0, start.value, end.value) * 100,
);
const sampleLabel = computed(() =>
  [
    sampleDate.value,
    ...reading.value.map(
      ({ key, value, text }) =>
        `${key.toUpperCase()} ${value === null ? 'unavailable' : text}`,
    ),
  ].join(', '),
);

function pointAt(event: PointerEvent) {
  const bounds = canvas.value?.getBoundingClientRect();
  if (!bounds || !props.points.length) return;
  const fraction = Math.max(
    0,
    Math.min(
      1,
      (event.clientX - bounds.left - pingPlotInset) /
        Math.max(1, bounds.width - pingPlotInset * 2),
    ),
  );
  const time = start.value + fraction * (end.value - start.value);
  cursorTime.value = props.points[nearestPingPoint(props.points, time)].t;
}

function stepSample(event: KeyboardEvent) {
  const last = props.points.length - 1;
  let next = sampleIndex.value;
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      next = Math.max(0, next - 1);
      break;
    case 'ArrowRight':
    case 'ArrowUp':
      next = Math.min(last, next + 1);
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = last;
      break;
    default:
      return;
  }
  event.preventDefault();
  cursorTime.value = props.points[next]?.t;
}
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
      <div
        class="ping-history-plot"
        role="slider"
        tabindex="0"
        aria-label="Historical carrier latency sample"
        :aria-valuemin="1"
        :aria-valuemax="Math.max(1, points.length)"
        :aria-valuenow="sampleIndex + 1"
        :aria-valuetext="sampleLabel"
        @pointermove="$event.pointerType !== 'touch' && pointAt($event)"
        @pointerdown="pointAt"
        @pointerleave="
          $event.pointerType !== 'touch' && (cursorTime = undefined)
        "
        @focus="cursorTime ??= end"
        @blur="cursorTime = undefined"
        @keydown="stepSample"
      >
        <canvas ref="canvas" aria-hidden="true"></canvas>
        <div
          v-if="sample && cursorTime !== undefined"
          class="ping-history-inspector"
          :class="{ 'tooltip-left': sampleX >= 50 }"
          :style="{ '--sample-x': sampleX + '%', inset: pingPlotInset + 'px' }"
          aria-hidden="true"
        >
          <div class="ping-history-crosshair"></div>
          <template v-for="{ key, color, value } in reading" :key="key">
            <span
              v-if="value !== null"
              class="ping-history-dot"
              :style="{
                background: color,
                top: (1 - value / maximum) * 100 + '%',
              }"
            ></span>
          </template>
          <div class="ping-history-tooltip">
            <time :datetime="new Date(sample.t * 1000).toISOString()">{{
              sampleDate
            }}</time>
            <div v-for="{ key, color, text } in reading" :key="key">
              <span :style="{ color }">{{ key.toUpperCase() }}</span>
              <span>{{ text }}</span>
            </div>
          </div>
        </div>
      </div>
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
.ping-history-plot {
  position: relative;
  min-width: 0;
  cursor: crosshair;
  touch-action: pan-y;
}
.ping-history-plot:focus-visible {
  outline: 2px solid var(--cyan);
  outline-offset: 3px;
}
.ping-history-inspector {
  --tooltip-width: 150px;
  --tooltip-left: calc(var(--sample-x) + 9px);
  position: absolute;
  pointer-events: none;
}
.ping-history-inspector.tooltip-left {
  --tooltip-left: calc(var(--sample-x) - var(--tooltip-width) - 9px);
}
.ping-history-crosshair,
.ping-history-dot {
  position: absolute;
  left: var(--sample-x);
}
.ping-history-crosshair {
  inset-block: 0;
  border-left: 1px dashed var(--muted);
}
.ping-history-dot {
  width: 7px;
  height: 7px;
  border: 1px solid var(--surface);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.ping-history-tooltip {
  position: absolute;
  top: 5px;
  left: clamp(0px, var(--tooltip-left), calc(100% - var(--tooltip-width)));
  width: var(--tooltip-width);
  padding: 5px 8px;
  border: 1px solid var(--dim);
  background: var(--surface);
  box-shadow: 2px 2px 0 var(--line);
  color: var(--text);
}
.ping-history-tooltip time {
  display: block;
  margin-bottom: 3px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
}
.ping-history-tooltip div {
  display: flex;
  justify-content: space-between;
}
.ping-history-empty {
  color: var(--muted);
  font-size: 11px;
}
</style>
