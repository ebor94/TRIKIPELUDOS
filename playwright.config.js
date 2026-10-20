import { defineConfig, devices } from '@playwright/test'

const BACK = process.env.TRK_BACKEND_DIR || '../mantix-git'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 800 },
    baseURL: 'http://localhost:5174/trikipeludos/',
    testIdAttribute: 'data-test',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'node src/trk/scripts/e2e-servidor.js',
      cwd: BACK,
      url: 'http://localhost:3021/api/trk/v1/auth/usuarios-pin',
      timeout: 120_000,
      reuseExistingServer: false
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174/trikipeludos/',
      env: { VITE_PROXY_TARGET: 'http://localhost:3021' },
      timeout: 60_000,
      reuseExistingServer: false
    }
  ]
})
