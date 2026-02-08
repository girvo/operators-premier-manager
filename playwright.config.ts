import { defineConfig, devices } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.com'
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'password'
const host = '127.0.0.1'
const port = process.env.E2E_PORT ?? '3335'
const baseURL = `http://${host}:${port}`
const seedEnv = `ADMIN_EMAIL=${adminEmail} ADMIN_PASSWORD=${adminPassword}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      `${seedEnv} HOST=${host} PORT=${port} node ace migration:fresh --seed --force ` +
      `&& ${seedEnv} HOST=${host} PORT=${port} node ace serve --no-clear`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
