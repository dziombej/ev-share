import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Fills a controlled React input, retrying if Astro island hydration
 * (client:load) resets the DOM value after Playwright's initial fill —
 * a race that can otherwise submit these forms with empty fields.
 */
export async function fillStable(locator: Locator, value: string) {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}

/**
 * Fills a form and submits it, retrying the whole sequence from scratch if a
 * late island hydration/remount wipes filled values *after* fillStable's own
 * check passes but before the submit takes effect — fillStable only guarantees
 * stability at check-time, not through to the next action. Gating success on
 * the real outcome (navigation) rather than a value snapshot closes that gap
 * without any blind sleep.
 */
export async function submitUntilNavigated(
  page: Page,
  fill: () => Promise<void>,
  submit: Locator,
  expectedUrl: string | RegExp,
) {
  await expect(async () => {
    await fill();
    await submit.click();
    await page.waitForURL(expectedUrl, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}
