<script setup lang="ts">
import { format } from '../../lib/core';
import type { NodeView } from '../../types';

defineProps<{ node: NodeView }>();
</script>

<template>
  <article class="memory-panel panel">
    <div class="panel-heading">
      <h2 class="color-orange">
        MEMORY
        <span id="selected-memory-amount">
          {{ node.memoryAmount }}
        </span>
      </h2>
      <strong id="selected-memory" class="color-orange">
        {{ format.percent(node.memoryUsage) }}
      </strong>
    </div>
    <div class="memory-layout">
      <div>
        <div class="big-meter">
          <i
            id="selected-memory-fill"
            :style="{ width: node.memoryFill + '%' }"
          ></i>
        </div>
        <div class="memory-legend">
          <span>
            <i class="legend-dot orange"></i>
            USED
            <b id="memory-used">{{ node.memoryUsed }}</b>
          </span>
          <span>
            <i class="legend-dot muted"></i>
            FREE
            <b id="memory-free">{{ node.memoryFree }}</b>
          </span>
        </div>
        <div class="swap-row">
          <span class="color-purple">SWAP</span>
          <span id="swap-amount">{{ node.swapAmount }}</span>
          <div class="swap-track">
            <i id="swap-fill" :style="{ width: node.swapFill + '%' }"></i>
          </div>
        </div>
      </div>
      <dl class="resource-counts">
        <dt>PROCESSES</dt>
        <dd id="process-count">{{ node.processCount }}</dd>
        <dt>THREADS</dt>
        <dd id="thread-count">{{ node.threadCount }}</dd>
        <dt>TCP / UDP</dt>
        <dd id="connection-count">
          {{ node.connectionCount }}
        </dd>
      </dl>
    </div>
  </article>
</template>
