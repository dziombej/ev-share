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

/**
 * Blocks until every Astro island on the page has finished hydrating.
 *
 * Astro server-renders each island inside `<astro-island ssr ...>` and removes
 * the `ssr` attribute once the client component has mounted. Filling a
 * *controlled* React island (e.g. PocForm's `useState("")` inputs) before that
 * moment is silently undone: hydration re-applies the component's own empty
 * state to the DOM node, the form then fails its client-side validation and
 * calls `preventDefault()`, and the submit never reaches the server.
 *
 * This is the one place the suite selects on a framework element rather than a
 * role/label (CLAUDE.md's locator rule): "the page is interactive" is not a
 * user-facing thing and has no accessible representation. It is still a wait on
 * real state, never a timeout.
 */
export async function waitForIslandsHydrated(page: Page) {
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0, { timeout: 10_000 });
}

/**
 * Removes the caller's own charging point, identified by its coordinates.
 *
 * Never "remove the first one": the specs run fully parallel against one shared
 * host account, so the newest POC in the list may well belong to another spec
 * that is still using it. Scoping the click to the card carrying this test's
 * unique coordinates is what keeps the specs independent.
 *
 * getByTestId here rather than a role/text locator because every card exposes
 * an identical "Remove" button — containment is the only thing that tells them
 * apart, and the card itself has no accessible name to select on.
 */
export async function removePocByCoords(page: Page, coords: string) {
  const card = page.getByTestId(/^my-poc-[0-9a-f-]{36}$/).filter({ hasText: coords });

  page.once("dialog", (dialog) => void dialog.accept());
  await card.getByRole("button", { name: "Remove" }).click();

  await expect(page.getByText(coords)).toHaveCount(0);
}
