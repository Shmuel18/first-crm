import { existsSync, readFileSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke suite for the critical flows (CLAUDE.md "Testing Philosophy":
 * login, open a case, documents, the calendar…). Runs against the LOCAL dev
 * server, which talks to the DEV Supabase project from `.env.local` — never
 * production. One command: `npm run e2e`.
 *
 * The signed-in user comes from E2E_USER_EMAIL / E2E_USER_PASSWORD in
 * `.env.local` (a dev-project test account the owner adds by hand; nothing
 * secret is committed).
 */
function loadEnvLocal(): void {
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*(E2E_[A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = (m[2] ?? '').replace(/^["']|["']$/g, '');
    }
  }
}
loadEnvLocal();

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // The dev server compiles each route on first hit — slow on a busy machine.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 180_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    },
    {
      name: 'mobile',
      dependencies: ['setup'],
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'], storageState: 'e2e/.auth/user.json' },
    },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 600_000,
  },
});
