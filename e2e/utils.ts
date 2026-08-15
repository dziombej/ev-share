import { expect, type Locator } from "@playwright/test";

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
