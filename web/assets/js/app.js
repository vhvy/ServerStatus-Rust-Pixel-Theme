/* Vue owns the interface; core.js owns data rules; charts.js owns Canvas. */
(() => {
  if (!window.Vue) {
    document.getElementById('boot-error').hidden = false;
    return;
  }

  const {
    createApp,
    ref,
    shallowRef,
    computed,
    watch,
    nextTick,
    onMounted,
    onUnmounted,
  } = Vue;
  const P = window.PixelStatus;
  const options = window.PIXEL_STATUS_CONFIG || {};
  const config = {
    title: options.title || 'Pixel Status',
    defaultTheme: options.defaultTheme === 'dark' ? 'dark' : 'light',
    endpoint: options.endpoint || '/json/stats.json',
    refreshInterval: Math.max(1000, Number(options.refreshInterval) || 5000),
    staleAfter: Math.max(10, Number(options.staleAfter) || 30),
    requestTimeout: Math.max(1000, Number(options.requestTimeout) || 8000),
    historyLimit: Math.max(
      2,
      Math.min(600, Number(options.historyLimit) || 60),
    ),
    nodeArt: options.nodeArt || {},
  };

  createApp({
    setup() {
      const payload = shallowRef(null);
      const histories = shallowRef(new Map());
      const selectedName = ref('');
      const filter = ref('all');
      const query = ref('');
      const sort = ref('default');
      const loading = ref(true);
      const error = ref('');
      const now = ref(Date.now());
      const theme = ref(config.defaultTheme);
      try {
        const savedTheme = localStorage.getItem('pixel-status-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          theme.value = savedTheme;
        }
      } catch {
        // Use the configured default when storage is disabled.
      }

      // Native browser integrations are limited to charts, dialog and focus.
      const searchInput = ref(null);
      const nodeCards = ref([]);
      const aboutDialog = ref(null);
      const cpuCanvas = ref(null);
      const networkCanvas = ref(null);

      const nodes = computed(() =>
        (payload.value?.servers || []).map((server) =>
          P.describe(server, config.nodeArt),
        ),
      );
      const visibleNodes = computed(() =>
        P.select(nodes.value, filter.value, query.value, sort.value),
      );
      const selectedNode = computed(() =>
        nodes.value.find((node) => node.name === selectedName.value),
      );
      const fleet = computed(() => P.aggregate(payload.value?.servers || []));
      const samples = computed(
        () => histories.value.get(selectedName.value) || [],
      );
      const selectedPosition = computed(() =>
        P.format.count(
          nodes.value.findIndex((node) => node.name === selectedName.value) + 1,
        ),
      );
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
      const selectedStatus = computed(() =>
        isPreviousReport.value
          ? 'LAST REPORT'
          : selectedNode.value?.active
            ? 'ONLINE'
            : 'OFFLINE',
      );
      const historyLabel = computed(() =>
        samples.value.length > 1
          ? `SESSION / ${samples.value.length} SAMPLES`
          : 'SESSION / WAITING FOR SAMPLES',
      );

      const connectionText = computed(() => {
        if (!payload.value)
          return loading.value
            ? 'CONNECTING TO THE FLEET'
            : 'SIGNAL UNAVAILABLE';
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

      let pollTimer;
      let clockTimer;
      let resizeTimer;
      let controller;
      let previousTimestamp = 0;
      let disposed = false;

      async function refresh() {
        if (loading.value && controller) return;
        clearTimeout(pollTimer);
        loading.value = true;
        controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
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

          if (!next.servers.some((node) => node.name === selectedName.value)) {
            selectedName.value = next.servers[0]?.name || '';
          }
        } catch (failure) {
          if (disposed) return;
          error.value =
            failure.name === 'AbortError'
              ? 'Request timed out'
              : failure instanceof TypeError
                ? 'Unable to read endpoint. Check connection or CORS'
                : failure.message;
        } finally {
          clearTimeout(timeout);
          controller = null;
          loading.value = false;
          if (!disposed && !document.hidden)
            pollTimer = setTimeout(refresh, config.refreshInterval);
        }
      }

      function resetFilters() {
        query.value = '';
        filter.value = 'all';
      }

      function stepNode(offset) {
        if (!nodes.value.length) return;
        const index = nodes.value.findIndex(
          (node) => node.name === selectedName.value,
        );
        selectedName.value =
          nodes.value[
            (index + offset + nodes.value.length) % nodes.value.length
          ].name;
      }

      async function focusNode(index, offset) {
        const list = visibleNodes.value;
        const next = list[(index + offset + list.length) % list.length];
        if (!next) return;
        selectedName.value = next.name;
        await nextTick();
        nodeCards.value
          .find((button) => button.dataset.node === next.name)
          ?.focus();
      }

      function drawCharts() {
        if (disposed) return;
        PixelCharts.cpu(cpuCanvas.value, samples.value);
        PixelCharts.network(networkCanvas.value, samples.value);
      }

      function resizeCharts() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(drawCharts, 100);
      }

      function resumePolling() {
        clearTimeout(pollTimer);
        if (!document.hidden) refresh();
      }

      function keyboardShortcut(event) {
        const editing =
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) ||
          event.target.isContentEditable;
        if (
          event.key === '/' &&
          !editing &&
          !aboutDialog.value?.open &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          searchInput.value?.focus();
        }
      }

      function closeOutsideDialog(event) {
        if (event.target !== aboutDialog.value) return;
        const bounds = aboutDialog.value.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          aboutDialog.value.close();
        }
      }

      watch(
        theme,
        (value) => {
          document.documentElement.dataset.theme = value;
          document.querySelector('meta[name="theme-color"]').content =
            value === 'dark' ? '#111521' : '#f5f2e9';
          try {
            localStorage.setItem('pixel-status-theme', value);
          } catch {
            /* Storage can be disabled. */
          }
          nextTick(drawCharts);
        },
        { immediate: true },
      );
      watch([selectedNode, samples], drawCharts, { flush: 'post' });

      onMounted(() => {
        document.title = config.title + ' / Server Monitor';
        clockTimer = setInterval(() => {
          now.value = Date.now();
        }, 1000);
        document.addEventListener('visibilitychange', resumePolling);
        document.addEventListener('keydown', keyboardShortcut);
        window.addEventListener('resize', resizeCharts);
        document.fonts?.ready.then(drawCharts);
        refresh();
      });

      onUnmounted(() => {
        disposed = true;
        controller?.abort();
        clearTimeout(pollTimer);
        clearTimeout(resizeTimer);
        clearInterval(clockTimer);
        document.removeEventListener('visibilitychange', resumePolling);
        document.removeEventListener('keydown', keyboardShortcut);
        window.removeEventListener('resize', resizeCharts);
      });

      return {
        config,
        payload,
        selectedName,
        filter,
        query,
        sort,
        loading,
        error,
        now,
        theme,
        searchInput,
        nodeCards,
        aboutDialog,
        cpuCanvas,
        networkCanvas,
        nodes,
        visibleNodes,
        selectedNode,
        fleet,
        samples,
        selectedPosition,
        isPreviousReport,
        onlineSummary,
        lastUpdate,
        selectedStatus,
        historyLabel,
        connectionText,
        warning,
        emptyState,
        format: P.format,
        filters: ['all', 'online', 'offline'],
        refresh,
        resetFilters,
        stepNode,
        focusNode,
        closeOutsideDialog,
      };
    },
  }).mount('#app');
})();
