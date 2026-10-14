import { createApp } from 'vue';
import App from './App.vue';
import { loadConfig } from './lib/configuration';
import './assets/style.css';

async function start() {
  const config = await loadConfig();
  createApp(App, { config }).mount('#app');
}

start().catch((error: unknown) => {
  const notice = document.getElementById('boot-error');
  if (notice) {
    notice.textContent =
      'Unable to start Pixel Status: ' +
      (error instanceof Error ? error.message : String(error));
    notice.hidden = false;
  }
  console.error(error);
});
