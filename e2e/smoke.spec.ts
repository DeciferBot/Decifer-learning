import { test, expect } from '@playwright/test'
import { expectNoHorizontalScroll } from './helpers/viewport'

/**
 * Smoke — runs UNCONDITIONALLY (no DB, no auth, no seeded content needed).
 * This is the green-by-default floor of the suite: if the homepage can't render
 * cleanly at 375px without console errors or horizontal scroll, nothing else
 * matters.
 */
test.describe('smoke — public homepage', () => {
  test('homepage loads with no console errors and no horizontal scroll at 375px', async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.goto('/')

    // Core homepage chrome must be present (CLAUDE.md §1 product copy).
    await expect(
      page.getByRole('heading', { level: 1 }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible()

    // Mobile contract — no horizontal scroll at the primary 375px viewport.
    expect(testInfo.project.use.viewport?.width).toBe(375)
    await expectNoHorizontalScroll(page)

    // Ignore known-noisy third-party / dev-only warnings if they ever surface;
    // hard-fail on genuine app errors and uncaught exceptions.
    const ignorable = /Download the React DevTools|favicon|web-vitals|hydration warning/i
    const realConsoleErrors = consoleErrors.filter((e) => !ignorable.test(e))
    expect(
      realConsoleErrors,
      `Console errors on homepage:\n${realConsoleErrors.join('\n')}`,
    ).toEqual([])
    expect(pageErrors, `Uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([])
  })

  test('login page renders at 375px without horizontal scroll', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('register page renders at 375px without horizontal scroll', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
