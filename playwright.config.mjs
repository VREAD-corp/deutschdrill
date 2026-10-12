import { defineConfig, devices } from '@playwright/test';
// Local: builds and serves _site on :4837. Live: BASE_URL=https://outils.vread.fr/deutschdrill/ npx playwright test
const live = process.env.BASE_URL;
const media = { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] };
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 2,
  timeout: 60_000,
  retries: live ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: live ?? 'http://localhost:4837/deutschdrill/', permissions: ['microphone'], launchOptions: media, acceptDownloads: true },
  projects: [
    { name: 'mobile-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, permissions: ['microphone'], launchOptions: media } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, permissions: ['microphone'], launchOptions: media } },
  ],
  webServer: live ? undefined : { command: 'python3 build.py && node scripts/serve.mjs 4837', url: 'http://localhost:4837/deutschdrill/', reuseExistingServer: true },
});
