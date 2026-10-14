<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
  type ComponentPublicInstance,
} from 'vue';
import { select, format } from '../lib/core';
import NodeCard from './NodeCard.vue';
import type {
  StatsPayload,
  NodeView,
  FleetSummary,
  EmptyState,
  StatusFilter,
  NodeSort,
} from '../types';

const props = defineProps<{
  nodes: NodeView[];
  payload: StatsPayload | null;
  fleet: FleetSummary;
  loading: boolean;
  emptyState: EmptyState;
  selectedName: string;
}>();
defineEmits<{ inspect: [name: string] }>();

const filter = ref<StatusFilter>('all');
const query = ref('');
const sort = ref<NodeSort>('default');
const searchInput = ref<HTMLInputElement | null>(null);
const cards = new Map<string, NodeCardHandle>();
const visibleNodes = computed(() =>
  select(props.nodes, filter.value, query.value, sort.value),
);
function setCardRef(
  name: string,
  card: Element | ComponentPublicInstance | null,
) {
  if (card && 'focus' in card && typeof card.focus === 'function') {
    const focus = card.focus;
    cards.set(name, { focus: () => focus() });
  } else cards.delete(name);
}
function focusNode(index: number, offset: number) {
  const list = visibleNodes.value;
  const next = list[(index + offset + list.length) % list.length];
  if (next) cards.get(next.name)?.focus();
}
function resetFilters() {
  query.value = '';
  filter.value = 'all';
}
function focusSearch() {
  searchInput.value?.focus({ preventScroll: true });
}
function keyboardShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  const editing =
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
    target.isContentEditable;
  if (
    event.key === '/' &&
    !editing &&
    !document.querySelector('dialog[open]') &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    event.preventDefault();
    focusSearch();
  }
}
defineExpose({ focusSearch });
onMounted(() => document.addEventListener('keydown', keyboardShortcut));
onUnmounted(() => document.removeEventListener('keydown', keyboardShortcut));

type NodeCardHandle = { focus(): void };

const filters: StatusFilter[] = ['all', 'online', 'offline'];
</script>

<template>
  <section id="fleet" class="fleet-section" aria-labelledby="fleet-title">
    <div class="fleet-title">
      <h2 id="fleet-title">
        THE FLEET
        <span id="visible-count">
          {{ format.count(visibleNodes.length) + ' NODES' }}
        </span>
      </h2>
      <span>SELECT A NODE TO INSPECT</span>
    </div>
    <div class="toolbar">
      <div class="filters" role="group" aria-label="Node status filter">
        <button
          v-for="status in filters"
          :key="status"
          class="filter"
          :class="{ active: filter === status }"
          :data-filter="status"
          :aria-pressed="filter === status"
          @click="filter = status"
        >
          {{ status.toUpperCase() }}
          <span :id="'filter-' + status">
            {{
              payload ? (status === 'all' ? nodes.length : fleet[status]) : '--'
            }}
          </span>
        </button>
      </div>
      <div class="list-tools">
        <label class="search">
          <span class="sr-only">Search nodes, locations or labels</span>
          <input
            id="search"
            type="search"
            placeholder="SEARCH THE FLEET..."
            autocomplete="off"
            ref="searchInput"
            v-model="query"
            @keydown.esc="query = ''"
          />
          <kbd>/</kbd>
        </label>
        <label>
          <span class="sr-only">Sort nodes</span>
          <select id="sort" v-model="sort">
            <option value="default">DEFAULT ORDER</option>
            <option value="name">NAME / A–Z</option>
            <option value="cpu">CPU / HIGH–LOW</option>
            <option value="memory">MEM / HIGH–LOW</option>
            <option value="traffic">NET / HIGH–LOW</option>
          </select>
        </label>
      </div>
    </div>
    <div id="server-list" class="server-list" :aria-busy="loading && !payload">
      <div v-if="!visibleNodes.length" class="empty-state">
        <h3>{{ emptyState.title }}</h3>
        <p>{{ emptyState.message }}</p>
        <button
          v-if="payload && nodes.length"
          id="reset-filters"
          @click="resetFilters"
        >
          RESET FILTERS
        </button>
      </div>
      <NodeCard
        v-for="(node, index) in visibleNodes"
        :key="node.name"
        :ref="(card) => setCardRef(node.name, card)"
        :node="node"
        :index="index"
        :selected="selectedName === node.name"
        @inspect="$emit('inspect', $event)"
        @focus-offset="focusNode(index, $event)"
      />
    </div>
    <div class="fleet-foot">
      <span>
        <i class="status-dot"></i>
        ONLINE
        <i class="status-dot offline"></i>
        OFFLINE
      </span>
      <span>HISTORY BEGINS WHEN YOU OPEN THIS PAGE.</span>
    </div>
  </section>
</template>
