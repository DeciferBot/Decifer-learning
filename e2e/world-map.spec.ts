import { test, expect } from '@playwright/test'
import { ensureChildSession } from './helpers/auth'
import { expectNoHorizontalScroll } from './helpers/viewport'

const LIVE = process.env.E2E_LIVE === '1'

/**
 * World map + topic unlocks (CLAUDE.md Phase 8).
 *
 * Requires a live DB with seeded zones + published topics for the child's year
 * group (app/(child)/world-map/page.tsx → ZoneMap / TopicNode).
 *
 * TopicNode states (components/world-map/TopicNode.tsx):
 *   - available/completed → wrapped in a <Link> (role=link, aria-label "<title>"
 *     or "<title> — completed"); the circle is clickable.
 *   - locked → NOT a link; renders a non-interactive <div> with an
 *     `sr-only` span "<title> — locked". This is the "not clickable" contract.
 */
test.describe('world map', () => {
  test.skip(!LIVE, 'Set E2E_LIVE=1 (live DB + seeded zones/topics) to run.')

  test('renders at 375px with no horizontal scroll', async ({ page }) => {
    await ensureChildSession(page)
    await page.goto('/world-map')

    await expect(page.getByRole('heading', { name: /world map/i })).toBeVisible()
    // At least one zone map region must render (aria-label "<zone> topic map").
    await expect(page.getByLabel(/topic map$/i).first()).toBeVisible({ timeout: 15_000 })

    await expectNoHorizontalScroll(page)
  })

  test('a locked node is not an interactive link', async ({ page }) => {
    await ensureChildSession(page)
    await page.goto('/world-map')

    // Locked nodes expose an sr-only "<title> — locked" label and are NOT links.
    // SUGGESTED data-testid: data-testid="topic-node-locked" on the locked <div>.
    const lockedMarker = page.getByText(/—\s*locked$/i).first()

    // If the seeded zone has no locked nodes yet (all available), skip the
    // assertion rather than fail — locking is sequential and depends on data.
    if (!(await lockedMarker.isVisible().catch(() => false))) {
      test.skip(true, 'No locked node present in seeded data for this child.')
    }

    // The locked title must not be reachable as a clickable link.
    const lockedTitle = (await lockedMarker.textContent())?.replace(/\s*—\s*locked$/i, '').trim()
    expect(lockedTitle).toBeTruthy()
    const asLink = page.getByRole('link', { name: new RegExp(`^${lockedTitle}`, 'i') })
    await expect(asLink).toHaveCount(0)
  })

  test('completing a topic unlocks the next node', async ({ page }) => {
    // This is the heaviest journey: it needs a child who can complete a quiz and
    // a zone with a sequential locked next-node. It is intentionally documented
    // and gated; wire up a deterministic seed (one completable topic + one
    // locked follow-on) before enabling.
    test.skip(
      true,
      'Enable once a deterministic seed exists: topic A (completable) gating topic B (locked). ' +
        'Flow: open A → finish quiz (≥70%) → return to /world-map → assert B is now a link.',
    )

    await ensureChildSession(page)
    await page.goto('/world-map')
    // 1. Capture a locked node title B (gated by topic A).
    // 2. Complete topic A's quiz at ≥70% (reuse the quiz flow from
    //    learn-practise-quiz.spec.ts).
    // 3. Reload /world-map and assert B is now reachable as a link:
    //    await expect(page.getByRole('link', { name: new RegExp(`^${titleB}`) })).toBeVisible()
  })
})
