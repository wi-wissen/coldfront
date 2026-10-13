import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Visual check playground for the chart components (not part of the package build).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  server: { port: 5176, strictPort: true, host: '127.0.0.1' },
});
