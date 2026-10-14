<script setup lang="ts">
import type { ThemeConfig, StatsPayload } from '../types';

defineProps<{
  payload: StatsPayload | null;
  isPreviousReport: boolean;
  connectionText: string;
  lastUpdate: string;
  config: ThemeConfig;
  loading: boolean;
  warning: string;
}>();
defineEmits<{ refresh: [] }>();
</script>

<template>
  <div>
    <div class="connection-strip">
      <div>
        <i
          id="connection-dot"
          class="status-dot"
          :class="{ pending: !payload || isPreviousReport }"
        ></i>
        <span id="connection-text" role="status">{{ connectionText }}</span>
      </div>
      <div class="sync-meta">
        <span id="last-update">{{ lastUpdate }}</span>
        <span id="poll-label">
          {{ 'AUTO / ' + config.refreshInterval / 1000 + 'S' }}
        </span>
        <button
          id="refresh"
          class="text-button"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          SYNC
        </button>
      </div>
    </div>
    <div id="notice" class="notice" role="status" v-show="warning">
      {{ warning }}
    </div>
  </div>
</template>
