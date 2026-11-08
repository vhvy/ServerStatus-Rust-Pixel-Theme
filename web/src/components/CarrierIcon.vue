<script setup lang="ts">
import type { NodeView } from '../types';

defineProps<{ carrier: NodeView['probes'][number]['carrier'] }>();

// Integer coordinates keep these small carrier-inspired marks on the pixel grid.
const paths = {
  CT: 'M5 1h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H5v-1H3v-2H2v-2H1V6h1V4h1V2h2V1Zm0 3H4v2H3v1h4V3H5v1Zm4-1v4h4V6h-1V4h-1V3H9ZM3 9v1h1v2h1v1h2V9H3Zm6 0v4h2v-1h1v-2h1V9H9Z',
  CU: 'M4 2h2v1h1v1h2V3h1V2h2v1h1v1h1v2h-1v1h-1v2h1v1h1v2h-1v1h-1v1h-2v-1H9v-1H7v1H6v1H4v-1H3v-1H2v-2h1V9h1V7H3V6H2V4h1V3h1V2Zm0 2v2h2V4H4Zm6 0v2h2V4h-2ZM6 7v2h1v1h2V9h1V7H9V6H7v1H6Zm-2 3v2h2v-2H4Zm6 0v2h2v-2h-2Z',
  CM: 'M5 1h6v1h2v2h1v2h-2V4h-1V3H5v1H4v1H3v6h1v1h1v1h6v-1h1v-1h2v2h-1v1h-2v1H5v-1H3v-1H2v-2H1V5h1V3h1V2h2V1Zm1 4h5v2H7v1H6v1h4V8h2V7h3v2h-2v1h-1v1H5V9H4V7h1V6h1V5Z',
};
</script>

<template>
  <svg
    class="carrier-icon"
    :class="'carrier-' + carrier.toLowerCase()"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    fill-rule="evenodd"
    shape-rendering="crispEdges"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="paths[carrier]" />
  </svg>
</template>

<style scoped>
.carrier-icon {
  flex: none;
}
.carrier-ct {
  color: var(--blue);
}
.carrier-cu {
  color: var(--danger);
}
.carrier-cm {
  color: var(--cyan);
}
</style>
