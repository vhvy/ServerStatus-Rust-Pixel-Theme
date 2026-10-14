<script setup lang="ts">
import { format } from '../../lib/core';
import type { NodeView } from '../../types';

defineProps<{ node: NodeView }>();
</script>

<template>
  <article class="disk-panel panel">
    <div class="panel-heading">
      <h2 class="color-yellow">DISK</h2>
      <strong id="selected-disk" class="color-yellow">
        {{ format.percent(node.diskUsage) }}
      </strong>
    </div>
    <div id="disk-amount" class="disk-amount">
      {{ node.diskAmount }}
    </div>
    <div class="disk-blocks" id="disk-blocks" aria-hidden="true">
      <i
        v-for="block in 48"
        :key="block"
        :class="{ used: block <= node.usedDiskBlocks }"
      ></i>
    </div>
    <div class="disk-caption">
      <span id="disk-free">
        {{ 'FREE ' + node.diskFree }}
      </span>
      <span>ALL DISKS</span>
    </div>
  </article>
</template>
