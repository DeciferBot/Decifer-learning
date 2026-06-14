import { expect, type Page } from '@playwright/test'

/**
 * Asserts the page has no horizontal scroll at the current (375px) viewport.
 *
 * CLAUDE.md §4.3 / §13: "No horizontal scroll at 375 px on any page."
 * We allow a 1px slack for sub-pixel rounding in the layout engine.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    scrollWidth,
    `Horizontal overflow: document scrollWidth ${scrollWidth}px exceeds viewport ${clientWidth}px`,
  ).toBeLessThanOrEqual(clientWidth + 1)
}
