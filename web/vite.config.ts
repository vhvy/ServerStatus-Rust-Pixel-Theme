import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
const backend = process.env.PIXEL_STATUS_BACKEND || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/json': backend,
      '/data/ping_history.json': backend,
    },
  },
});
