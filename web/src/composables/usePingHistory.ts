import { computed, ref, shallowRef, watch } from 'vue';
import type { PingHistoryPoint } from '../types';

const refreshInterval = 60_000;

export function usePingHistory(nodeName: () => string | undefined) {
  const history = shallowRef<Record<string, PingHistoryPoint[]>>({});
  const loading = ref(false);
  let requestedAt = -Infinity;

  async function refresh() {
    const now = performance.now();
    if (loading.value || now - requestedAt < refreshInterval) return;
    requestedAt = now;
    loading.value = true;
    try {
      const response = await fetch('/data/ping_history.json', {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 404) history.value = {};
      if (!response.ok) return;
      const data = (await response.json()) as typeof history.value | null;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        history.value = data;
      }
    } catch {
      // Keep the last snapshot during a transient failure.
    } finally {
      loading.value = false;
    }
  }

  watch(
    () => !!nodeName(),
    (open, _, onCleanup) => {
      if (!open) return;
      let timer: ReturnType<typeof setTimeout>;
      function poll() {
        void refresh();
        const age = performance.now() - requestedAt;
        timer = setTimeout(poll, Math.max(1, refreshInterval - age));
      }
      poll();
      onCleanup(() => clearTimeout(timer));
    },
    { immediate: true },
  );

  const points = computed(() => {
    const name = nodeName();
    const series =
      name && Object.hasOwn(history.value, name) && history.value[name];
    return Array.isArray(series) ? series : [];
  });
  return { points, loading };
}
