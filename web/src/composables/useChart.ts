import { watch, onMounted, onUnmounted, type Ref } from 'vue';
import type { Theme } from '../types';

// Each chart owns its canvas and redraws when visible, resized or restyled.
export function useChart<Sample>(
  canvas: Ref<HTMLCanvasElement | null>,
  samples: () => Sample[],
  theme: () => Theme,
  draw: (canvas: HTMLCanvasElement | null, samples: Sample[]) => void,
) {
  let observer: ResizeObserver | undefined;
  let resolution: MediaQueryList | undefined;
  let disposed = false;
  function redraw() {
    if (!disposed) draw(canvas.value, samples());
  }
  function watchResolution() {
    resolution?.removeEventListener('change', watchResolution);
    resolution = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    resolution.addEventListener('change', watchResolution);
    redraw();
  }
  watch([samples, theme], redraw, { flush: 'post' });
  onMounted(() => {
    observer = new ResizeObserver(redraw);
    if (canvas.value) observer.observe(canvas.value);
    document.fonts?.ready.then(redraw);
    watchResolution();
  });
  onUnmounted(() => {
    disposed = true;
    observer?.disconnect();
    resolution?.removeEventListener('change', watchResolution);
  });
}
