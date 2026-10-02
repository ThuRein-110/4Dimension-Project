import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:5173', screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173/api/health', reuseExistingServer: !process.env.CI },
});
