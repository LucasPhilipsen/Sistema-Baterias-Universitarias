import { defineConfig, devices } from '@playwright/test';

const baseURL = `http://127.0.0.1:${Number(process.env.E2E_PORT) || 5174}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL } },
  ],
  webServer: {
    command: 'node e2e/server.js',
    url: baseURL,
    env: { NODE_ENV: 'test' },
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
});
