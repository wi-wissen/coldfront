import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// Locally the preinstalled Chromium is used (CF_CHROMIUM or the sandbox default); in CI Playwright's own browser.
const sandbox = '/opt/pw-browsers/chromium';
const executablePath = process.env.CF_CHROMIUM ?? (existsSync(sandbox) ? sandbox : undefined);
const port = Number(process.env.CF_E2E_PORT ?? 5177);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 90_000,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${port}/`, launchOptions: { executablePath, args: ['--no-sandbox'] }, locale: 'de-DE' },
  webServer: {
    command: `npm run preview -w @coldfront/site -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/index.html`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
