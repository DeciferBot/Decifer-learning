import { expect, type Page } from '@playwright/test'

/**
 * Auth helpers for the LIVE journeys. These drive the real Supabase-backed
 * register / login forms (app/(auth)/register/RegisterForm.tsx and
 * app/(auth)/login/LoginForm.tsx) using resilient role/text selectors.
 *
 * NOTE: registering a child whose Supabase project has email confirmation ON
 * will NOT produce a session — the form shows a "Check your email" notice
 * instead of routing to /dashboard. For E2E, the project under test must have
 * email confirmation disabled (or use a pre-seeded account + signIn()). See
 * e2e/README.md → "Data-seeding prerequisites".
 */

export type DisposableAccount = {
  displayName: string
  email: string
  parentEmail: string
  password: string
}

/** Build a unique, disposable account so reruns never collide. */
export function makeDisposableAccount(prefix = 'child'): DisposableAccount {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  return {
    displayName: `E2E ${prefix} ${stamp}`,
    email: `e2e+${prefix}-${stamp}@example.com`,
    parentEmail: `e2e+parent-${stamp}@example.com`,
    password: 'e2e-Password-123',
  }
}

/**
 * Register a CHILD account: choose role → pick a year group → fill the form →
 * submit. Defaults to "Year 3" (the MVP KS2 cohort).
 *
 * Returns true if a session was created (routed to /dashboard*), false if the
 * app showed the email-confirmation notice instead.
 */
export async function registerChild(
  page: Page,
  account: DisposableAccount,
  yearLabel: 'Year 3' | 'Year 7' = 'Year 3',
): Promise<boolean> {
  await page.goto('/register')

  // Role picker — buttons are labelled by role text ("child" / "parent").
  // SUGGESTED data-testid: data-testid="role-child" on the role <button>.
  await page.getByRole('button', { name: /^child$/i }).click()

  // Year group picker — buttons read e.g. "Year 3 (KS2)". Match the year prefix.
  // SUGGESTED data-testid: data-testid="year-group-3".
  await page.getByRole('button', { name: new RegExp(`^${yearLabel}\\b`, 'i') }).click()

  // Text fields are wrapped in <label><span>…</span><input/></label>, so the
  // accessible name comes from the span text.
  await page.getByLabel(/display name/i).fill(account.displayName)
  await page.getByLabel(/^email$/i).fill(account.email)
  await page.getByLabel(/parent or guardian.*email/i).fill(account.parentEmail)
  await page.getByLabel(/^password$/i).fill(account.password)

  // Parental consent checkbox (always required for child accounts).
  // SUGGESTED data-testid: data-testid="parental-consent".
  await page.getByRole('checkbox').first().check()

  await page.getByRole('button', { name: /create account/i }).click()

  // Either we land on a dashboard route (session created) or we see the
  // "check your email" status notice (email confirmation enabled).
  const landed = page
    .waitForURL(/\/dashboard/, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
  const notice = page
    .getByRole('status')
    .filter({ hasText: /check your email/i })
    .waitFor({ timeout: 15_000 })
    .then(() => false)
    .catch(() => null)

  const result = await Promise.race([landed, notice])
  return result === true
}

/** Sign in an existing account via the password tab. */
export async function loginWithPassword(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login')
  // Password tab is the default mode, but click it to be explicit/resilient.
  await page.getByRole('button', { name: /^password$/i }).click().catch(() => {})
  await page.getByLabel(/^email$/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
}

/**
 * Ensure we have a logged-in child session. Registers a fresh disposable
 * account and, if email confirmation blocks the session, fails clearly so the
 * operator knows to disable confirmation on the test project.
 */
export async function ensureChildSession(page: Page): Promise<DisposableAccount> {
  const account = makeDisposableAccount('child')
  const hasSession = await registerChild(page, account)
  expect(
    hasSession,
    'Child registration did not create a session — disable Supabase email confirmation ' +
      'on the E2E project (or seed a confirmed child account). See e2e/README.md.',
  ).toBe(true)
  return account
}
