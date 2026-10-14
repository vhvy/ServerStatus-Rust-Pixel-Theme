import { ref, watch } from 'vue';
import type { Theme } from '../types';

export function useTheme(defaultTheme: Theme) {
  const theme = ref<Theme>(defaultTheme);
  try {
    const saved = localStorage.getItem('pixel-status-theme');
    if (saved === 'light' || saved === 'dark') theme.value = saved;
  } catch {
    // Keep the configured default when storage is disabled.
  }
  watch(
    theme,
    (value) => {
      document.documentElement.dataset.theme = value;
      document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
      )!.content = value === 'dark' ? '#111521' : '#f5f2e9';
      try {
        localStorage.setItem('pixel-status-theme', value);
      } catch {
        // The selected theme still works without persistence.
      }
    },
    { immediate: true },
  );
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }
  return { theme, toggleTheme };
}
