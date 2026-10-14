<script setup lang="ts">
import { format } from '../lib/core';
import type { Theme } from '../types';

defineProps<{ title: string; now: number; theme: Theme }>();
defineEmits<{ 'toggle-theme': []; about: [] }>();
</script>

<template>
  <header class="masthead">
    <a class="wordmark" href="#">
      <span class="site-title">{{ title }}</span>
      <span class="blink" aria-hidden="true">_</span>
    </a>
    <span class="header-caption">A TINY SERVER OBSERVATORY</span>
    <div class="header-right">
      <time id="clock">{{ format.time(now / 1000) }}</time>
      <button
        id="theme-toggle"
        class="text-button"
        :aria-label="
          theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        "
        @click="$emit('toggle-theme')"
      >
        {{ theme === 'dark' ? 'LIGHT' : 'DARK' }}
      </button>
      <button id="about-open" class="text-button" @click="$emit('about')">
        ABOUT
      </button>
    </div>
  </header>
</template>
