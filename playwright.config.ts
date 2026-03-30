import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { loadEnv } from 'vite';

function mergeNoProxy(currentValue: string | undefined, entries: string[]): string {
  const currentEntries = (currentValue || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const mergedEntries = new Set([...currentEntries, ...entries]);
  return Array.from(mergedEntries).join(',');
}

const envDir = path.resolve(process.cwd(), 'env');
const fileEnv = loadEnv('e2e', envDir, '');
const host = process.env.PLAYWRIGHT_HOST || fileEnv.PLAYWRIGHT_HOST || '::1';
const port = Number.parseInt(process.env.PLAYWRIGHT_PORT || fileEnv.PLAYWRIGHT_PORT || '42173', 10);
const externalBaseURL =
  (process.env.PLAYWRIGHT_BASE_URL ?? fileEnv.PLAYWRIGHT_BASE_URL ?? '').trim() || undefined;
const appEnv = process.env.PLAYWRIGHT_APP_ENV || fileEnv.PLAYWRIGHT_APP_ENV || 'test';
const noProxyAppend =
  process.env.PLAYWRIGHT_NO_PROXY_APPEND || fileEnv.PLAYWRIGHT_NO_PROXY_APPEND || '';
const webServerCommand = 'node scripts/e2e/start-vite.mjs';

function formatBaseURL(hostname: string, portNumber: number): string {
  const normalizedHost = hostname.includes(':') ? `[${hostname}]` : hostname;
  return `http://${normalizedHost}:${portNumber}`;
}

const baseURL = externalBaseURL ?? formatBaseURL(host, port);
const noProxyEntries = noProxyAppend
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const mergedNoProxy = mergeNoProxy(process.env.NO_PROXY ?? process.env.no_proxy, noProxyEntries);

if (mergedNoProxy) {
  process.env.NO_PROXY = mergedNoProxy;
  process.env.no_proxy = mergedNoProxy;
}

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: webServerCommand,
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...fileEnv,
          FORCE_COLOR: '0',
          PLAYWRIGHT_APP_ENV: appEnv,
          PLAYWRIGHT_HOST: host,
          PLAYWRIGHT_NO_PROXY_APPEND: noProxyAppend,
          PLAYWRIGHT_PORT: String(port),
        },
        gracefulShutdown: {
          signal: 'SIGTERM',
          timeout: 5000,
        },
        name: 'ViteE2E',
        url: baseURL,
        reuseExistingServer: false,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 30000,
      },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
