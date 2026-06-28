import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100'
const purgeE2EEnabled =
  process.env.PURGE_E2E_CONFIRM === 'dedicated-neon-branch' &&
  Boolean(process.env.PURGE_E2E_DATABASE_URL)
const fontMockPath = path.resolve(
  __dirname,
  'tests/e2e/next-font-google-mocks.cjs'
)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --webpack --hostname 127.0.0.1 --port 3100',
    env: {
      ...process.env,
      ...(purgeE2EEnabled
        ? {
            DATABASE_URL: process.env.PURGE_E2E_DATABASE_URL as string,
            FILE_STORAGE_PROVIDER: 'local',
            FILE_STORAGE_LOCAL_DIR:
              process.env.PURGE_E2E_STORAGE_DIR ?? '/tmp/zenquanta-purge-e2e',
            FILE_STORAGE_BUCKET: 'zenquanta-purge-e2e',
          }
        : {}),
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES:
        process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES ?? fontMockPath,
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
