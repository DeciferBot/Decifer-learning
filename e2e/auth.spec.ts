import { test, expect } from '@playwright/test'
import { makeDisposableAccount, registerChild } from './helpers/auth'
import { expectNoHorizontalScroll } from './helpers/viewport'

const LIVE = process.env.E2E_LIVE === '1'

test.describe('auth — protected route redirect (no DB needed)', () => {
  test('logged-out access to /dashboard redirects to /login', async ({ page }) => {
    // middleware.ts redirects unauthenticated /dashboard → /login. For the bare
    // /dashboard path it intentionally omits the redirectTo query param.
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login(\?|$)/)
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()
  })

  test('logged-out access to a deep child route redirects to /login with redirectTo', async ({
    page,
  }) => {
    await page.goto('/world-map')
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fworld-map/)
  })
})

test.describe('auth — full registration journey', () => {
  // Needs a live Supabase project with email confirmation OFF (so signUp yields
  // a session). Gated behind E2E_LIVE so CI is green without it.
  test.skip(!LIVE, 'Set E2E_LIVE=1 (live Supabase, email confirmation off) to run.')

  test('register → role child → Year 3 → lands on /dashboard', async ({ page }) => {
    const account = makeDisposableAccount('child')
    const hasSession = await registerChild(page, account, 'Year 3')

    expect(
      hasSession,
      'Expected a session after child signup. If this fails with the "check your ' +
        'email" notice, disable email confirmation on the E2E Supabase project.',
    ).toBe(true)

    await expect(page).toHaveURL(/\/dashboard/)
    await expectNoHorizontalScroll(page)
  })
})
