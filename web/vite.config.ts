import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/json': process.env.PIXEL_STATUS_BACKEND || 'http://127.0.0.1:8080',
    },
  },
});
