import { defineConfig, devices } from '@playwright/test'

/**
 * Decifer Learning — Playwright E2E config.
 *
 * Mobile-first: the app is designed at 375 px (iPhone SE) first, and CLAUDE.md
 * §4/§13 require no horizontal scroll at that width. The PRIMARY project runs at
 * a 375px-wide viewport so the regression net matches the real target device.
 *
 * Env:
 *   E2E_BASE_URL  — base URL under test (default http://localhost:3000)
 *   E2E_LIVE=1    — opt in to the data-dependent journeys (auth, learn/quiz,
 *                   offline sync, world map). These need a live Supabase DB +
 *                   seeded published content. Without it, only the smoke spec
 *                   runs real assertions; the rest skip and the suite is green.
 *   CI            — enables retries + disables reuse of an existing dev server.
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // Each test gets up to 60s; auth + DB round-trips can be slow.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Fail the build if test.only is left in source on CI.
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Serialise locally to keep the shared dev server + disposable accounts sane.
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      // PRIMARY — iPhone SE class device, 375px-wide viewport. This is the
      // contract: the whole app must work and not scroll horizontally here.
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone SE'],
        // devices['iPhone SE'] already pins viewport to 375x667 + isMobile.
        // Pin it explicitly too, so the assertion math in smoke.spec stays stable
        // even if Playwright's device preset shifts in a future release.
        viewport: { width: 375, height: 667 },
        baseURL,
      },
    },
    {
      // Secondary desktop sanity project — opt-in via `--project=desktop-chromium`.
      // Not run by default; the mobile contract is what matters for the pilot.
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], baseURL },
    },
  ],

  // Boot the Next.js dev server for the suite. Locally we reuse an already-running
  // server (so `npm run dev` in another terminal is picked up); CI always starts fresh.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !isCI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
