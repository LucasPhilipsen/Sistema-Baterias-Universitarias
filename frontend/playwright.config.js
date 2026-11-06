import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL } },
  ],
  webServer: {
    command: 'node e2e/server.js',
    url: 'http://127.0.0.1:5174',
    env: { NODE_ENV: 'test' },
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
});
