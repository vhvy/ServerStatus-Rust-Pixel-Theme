import { ref, shallowRef, computed, onMounted, onUnmounted } from 'vue';
import * as P from '../lib/core';
import type { HistorySample, StatsPayload, ThemeConfig } from '../types';

// Own polling, freshness and per-node history independently of the UI.
export function useTelemetry(config: ThemeConfig) {
  const payload = shallowRef<StatsPayload | null>(null);
  const histories = shallowRef(new Map<string, HistorySample[]>());
  const loading = ref(true);
  const error = ref('');
  const now = ref(Date.now());
  const nodes = computed(() =>
    (payload.value?.servers || []).map((server) =>
      P.describe(server, config.nodeArt),
    ),
  );
  const fleet = computed(() => P.aggregate(payload.value?.servers || []));
  const delay = computed(() =>
    payload.value ? now.value / 1000 - payload.value.updated : 0,
  );
  const isDelayed = computed(
    () => !!payload.value && Math.abs(delay.value) > config.staleAfter,
  );
  const isPreviousReport = computed(() => isDelayed.value || !!error.value);
  const onlineSummary = computed(() =>
    payload.value
      ? `${fleet.value.online} ONLINE / ${fleet.value.offline} OFF`
      : 'WAITING FOR SIGNAL',
  );
  const lastUpdate = computed(() =>
    payload.value
      ? 'SOURCE ' + P.format.time(payload.value.updated)
      : 'LAST SYNC --:--:--',
  );
  const connectionText = computed(() => {
    if (!payload.value)
      return loading.value ? 'CONNECTING TO THE FLEET' : 'SIGNAL UNAVAILABLE';
    if (error.value) return 'CONNECTION LOST / LAST REPORT';
    return isDelayed.value
      ? 'TIMESTAMP DELAY / LAST REPORT'
      : 'RECEIVING NODE TELEMETRY';
  });

  const warning = computed(() => {
    if (error.value) return error.value + '. Retrying automatically.';
    if (!isDelayed.value) return '';
    const minutes = Math.round(Math.abs(delay.value) / 60);
    const direction = delay.value > 0 ? 'behind' : 'ahead of';
    return `Source timestamp ${minutes} min ${direction} your local clock. Values are from the last report; check source freshness or clock synchronization.`;
  });

  const emptyState = computed(() => {
    if (!payload.value)
      return error.value
        ? {
            title: 'SIGNAL UNAVAILABLE',
            message: 'Check the endpoint, then press SYNC to retry.',
          }
        : {
            title: 'ACQUIRING SIGNAL...',
            message: 'Waiting for the first node report.',
          };
    return nodes.value.length
      ? {
          title: 'NO MATCHING NODES',
          message: 'Try a different name, location or status.',
        }
      : {
          title: 'NO NODES YET',
          message: 'Connected. Waiting for probes to report.',
        };
  });

  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | null = null;
  let previousTimestamp = 0;
  let disposed = false;
  async function refresh() {
    if (loading.value && controller) return;
    clearTimeout(pollTimer);
    loading.value = true;
    controller = new AbortController();
    const timeout = setTimeout(
      () => controller?.abort(),
      config.requestTimeout,
    );

    try {
      const response = await fetch(config.endpoint, {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error('Endpoint returned HTTP ' + response.status);

      let next;
      try {
        next = P.validate(await response.json());
      } catch (failure) {
        throw new Error(
          failure instanceof SyntaxError
            ? 'Invalid JSON response'
            : 'Invalid ServerStatus-Rust response',
        );
      }
      if (disposed) return;

      if (next.updated < previousTimestamp) histories.value = new Map();
      if (next.updated !== previousTimestamp) {
        histories.value = P.appendHistory(histories.value, next, config);
      }
      previousTimestamp = next.updated;
      payload.value = next;
      error.value = '';
    } catch (failure) {
      if (disposed) return;
      error.value =
        failure instanceof Error && failure.name === 'AbortError'
          ? 'Request timed out'
          : failure instanceof TypeError
            ? 'Unable to read endpoint. Check connection or CORS'
            : failure instanceof Error
              ? failure.message
              : String(failure);
    } finally {
      clearTimeout(timeout);
      controller = null;
      loading.value = false;
      if (!disposed && !document.hidden)
        pollTimer = setTimeout(refresh, config.refreshInterval);
    }
  }

  function resumePolling() {
    clearTimeout(pollTimer);
    if (!document.hidden) refresh();
  }

  onMounted(() => {
    document.title = config.title + ' / Server Monitor';
    clockTimer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
    document.addEventListener('visibilitychange', resumePolling);
    refresh();
  });
  onUnmounted(() => {
    disposed = true;
    controller?.abort();
    clearTimeout(pollTimer);
    clearInterval(clockTimer);
    document.removeEventListener('visibilitychange', resumePolling);
  });
  return {
    payload,
    histories,
    loading,
    error,
    now,
    nodes,
    fleet,
    isPreviousReport,
    onlineSummary,
    lastUpdate,
    connectionText,
    warning,
    emptyState,
    refresh,
  };
}
