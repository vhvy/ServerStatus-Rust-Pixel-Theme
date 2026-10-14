<script setup lang="ts">
import type { NodeView } from '../../types';

defineProps<{ node: NodeView; selectedStatus: string }>();
</script>

<template>
  <article class="device-panel panel">
    <div class="device-label">
      <span id="selected-kind">{{ node.kindLabel }}</span>
      <span id="selected-status" class="color-green">{{ selectedStatus }}</span>
    </div>
    <div class="device-art">
      <img
        id="selected-art"
        :src="node.art"
        :alt="node.artAlt"
        width="320"
        height="240"
      />
    </div>
    <h1
      id="selected-name"
      :class="{ 'long-name': node.displayName.length > 24 }"
    >
      {{ node.displayName }}
    </h1>
    <div id="selected-platform" class="device-platform">
      {{ node.platform }}
    </div>
    <div id="selected-uptime" class="device-uptime">
      {{ node.uptimeLabel }}
    </div>
    <div class="protocols">
      <span id="selected-ipv4" :class="{ up: node.online4 }">
        {{ 'IPV4 ' + (node.online4 ? 'UP' : 'DOWN') }}
      </span>
      <span id="selected-ipv6" :class="{ up: node.online6 }">
        {{ 'IPV6 ' + (node.online6 ? 'UP' : 'DOWN') }}
      </span>
      <span id="selected-location">
        {{ node.locationCode }}
      </span>
    </div>
  </article>
</template>
