import { watch, onMounted, onUnmounted, type Ref } from 'vue';
import type { HistorySample, Theme } from '../types';

// Each chart owns its canvas and redraws when visible, resized or restyled.
export function useChart(
  canvas: Ref<HTMLCanvasElement | null>,
  samples: () => HistorySample[],
  theme: () => Theme,
  draw: (canvas: HTMLCanvasElement | null, samples: HistorySample[]) => void,
) {
  let observer: ResizeObserver | undefined;
  let disposed = false;
  function redraw() {
    if (!disposed) draw(canvas.value, samples());
  }
  watch([samples, theme], redraw, { flush: 'post' });
  onMounted(() => {
    observer = new ResizeObserver(redraw);
    if (canvas.value) observer.observe(canvas.value);
    document.fonts?.ready.then(redraw);
    redraw();
  });
  onUnmounted(() => {
    disposed = true;
    observer?.disconnect();
  });
}
