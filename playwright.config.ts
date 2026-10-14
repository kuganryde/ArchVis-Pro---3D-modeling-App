import { defineConfig } from '@playwright/test';

// E2E runs against the PRODUCTION build (npm run build && npm start) so that the
// enforced Content-Security-Policy is exercised exactly as it ships.
const PORT = Number(process.env.E2E_PORT) || 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  // Software WebGL (SwiftShader) re-renders the whole scene on every pointer move and asset
  // edit; with the detailed device and furniture models, parallel workers need the headroom.
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      // CI installs Playwright's own Chromium; locally/in sandboxes point at an
      // existing binary with E2E_CHROMIUM_PATH. SwiftShader gives headless WebGL.
      executablePath: process.env.E2E_CHROMIUM_PATH || undefined,
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm run start',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { NODE_ENV: 'production', PORT: String(PORT) },
    timeout: 60_000,
  },
});
