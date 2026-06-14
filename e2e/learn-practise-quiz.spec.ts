import { test, expect, type Page } from '@playwright/test'
import { ensureChildSession } from './helpers/auth'
import { expectNoHorizontalScroll } from './helpers/viewport'

const LIVE = process.env.E2E_LIVE === '1'

/**
 * Core child loop: Learn → Practise → Quiz (CLAUDE.md Phase 4/5).
 *
 * Requires a live DB AND at least one published Year-3 topic with published
 * learn_content + quiz_questions. The dashboard surfaces a "first topic" CTA
 * linking to /topics/<id>/learn and /topics/<id>/quiz (app/dashboard/child/page.tsx).
 *
 * Hard rule under test (CLAUDE.md §8): NO staged/flagged content is ever shown.
 * We assert no status leakage strings ("staged", "flagged", "regenerating")
 * appear anywhere in the child-facing DOM.
 */
test.describe('learn → practise → quiz', () => {
  test.skip(!LIVE, 'Set E2E_LIVE=1 (live DB + seeded Year-3 content) to run.')

  test.describe.configure({ mode: 'serial' })

  async function assertNoStagedLeakage(page: Page): Promise<void> {
    const body = (await page.locator('body').innerText()).toLowerCase()
    for (const banned of ['staged', 'flagged', 'regenerating']) {
      expect(body, `Non-published status word "${banned}" leaked into child UI`).not.toContain(
        banned,
      )
    }
  }

  /** Find the first "Start" / topic-learn link the child dashboard offers. */
  async function gotoFirstTopicLearn(page: Page): Promise<string> {
    await page.goto('/dashboard');
    // The role gateway forwards /dashboard → /dashboard/child.
    await page.waitForURL(/\/dashboard\/child/, { timeout: 15_000 }).catch(() => {})

    // Prefer an explicit learn link; fall back to any /topics/<id>/learn href.
    // SUGGESTED data-testid: data-testid="start-topic" on the primary CTA.
    const learnLink = page.locator('a[href*="/topics/"][href*="/learn"]').first()
    await expect(
      learnLink,
      'No published topic CTA on the child dashboard — seed a published Year-3 topic.',
    ).toBeVisible({ timeout: 15_000 })

    const href = await learnLink.getAttribute('href')
    expect(href).toBeTruthy()
    await learnLink.click()
    return href as string
  }

  test('Learn page renders for a real published topic', async ({ page }) => {
    await ensureChildSession(page)
    const learnHref = await gotoFirstTopicLearn(page)

    await expect(page).toHaveURL(new RegExp(learnHref.replace(/[/]/g, '\\/')))
    // Learn pages render lesson body content; just assert non-trivial text + heading.
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await assertNoStagedLeakage(page)
  })

  test('Quiz flow: answer a question and see immediate feedback', async ({ page }) => {
    await ensureChildSession(page)
    const learnHref = await gotoFirstTopicLearn(page)
    const quizHref = learnHref.replace(/\/learn$/, '/quiz')

    await page.goto(quizHref)
    await expectNoHorizontalScroll(page)
    await assertNoStagedLeakage(page)

    // QuizShell may show a DifficultyPicker first — pick "mixed"/any if present.
    const difficulty = page.getByRole('button', { name: /mixed|explorer|sprout|lightning/i })
    if (await difficulty.first().isVisible().catch(() => false)) {
      await difficulty.first().click()
    }

    // MCQ choices are grid buttons (QuizShell). Click the first choice.
    // SUGGESTED data-testid: data-testid="quiz-choice" on each choice <button>.
    const choices = page.locator('.grid button')
    await expect(choices.first()).toBeVisible({ timeout: 15_000 })
    await choices.first().click()

    // Immediate feedback: "Correct!" or "The answer is …" copy appears.
    // SUGGESTED data-testid: data-testid="quiz-feedback" on the feedback panel.
    await expect(
      page.getByText(/correct!|the answer is|got it on attempt/i).first(),
    ).toBeVisible({ timeout: 10_000 })

    // A "Next Question →" / "See Results" advance button must follow.
    await expect(
      page.getByRole('button', { name: /next question|see results/i }),
    ).toBeVisible()
  })
})
