import { test, expect, type Locator, type Page } from "@playwright/test";
import { fillStable, submitUntilNavigated } from "../utils";

// Radix Select's trigger occasionally doesn't visibly open on the first synthetic
// click under Playwright, and a late Astro island hydration/remount can wipe an
// already-selected value before the caller's next action reads it — the open,
// select, and post-selection check all live inside one retry so a partial or
// stale selection never survives past this call.
async function selectOption(page: Page, trigger: Locator, optionName: string) {
  const option = page.getByRole("option", { name: optionName });
  await expect(async () => {
    await trigger.click();
    await option.waitFor({ state: "visible", timeout: 2000 });
    await option.click();
    await expect(trigger).toContainText(optionName, { timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

// Same hydration-race guard as selectOption, for the seeker-email search
// combobox: types the query, waits for the matching result, clicks it, and
// confirms the popover actually closed (proof React's onSelect ran) before
// declaring success — retrying the whole type-then-select if a remount wipes
// the query or the pending selection.
async function searchAndSelect(page: Page, input: Locator, query: string, optionName: string) {
  const option = page.getByRole("option", { name: optionName });
  await expect(async () => {
    await input.fill(query);
    await option.waitFor({ state: "visible", timeout: 3000 });
    await option.click();
    await expect(option).toBeHidden({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
}

// Drives the full US-01 loop with two real signed-in identities: the "host"
// (default storageState from e2e/auth.setup.ts) and the "seeker" (from
// e2e/auth.seeker.setup.ts) — opting out of the project's single default
// storageState so both browser contexts can be authenticated at once.
test.use({ storageState: { cookies: [], origins: [] } });

function parseBalance(text: string): number {
  const match = /(-?\d+(?:\.\d+)?)/.exec(text);
  if (!match) {
    throw new Error(`Could not parse balance from "${text}"`);
  }
  return Number(match[1]);
}

test("logging a session updates both host and seeker balances by the identical amount", async ({ browser }) => {
  // Default 30s test timeout is too tight for this flow: two real browser contexts,
  // ~6 SSR navigations, and per-step retry budgets (up to 30s/45s below) sized to
  // ride out a late island hydration/remount rather than a normal-case duration.
  test.setTimeout(120_000);

  const seekerEmail = process.env.E2E_SEEKER_USERNAME;
  if (!seekerEmail) {
    throw new Error("E2E_SEEKER_USERNAME must be set (see .env.test.example)");
  }

  const hostContext = await browser.newContext({ storageState: "playwright/.auth/user.json" });
  const seekerContext = await browser.newContext({ storageState: "playwright/.auth/seeker.json" });
  const hostPage = await hostContext.newPage();
  const seekerPage = await seekerContext.newPage();

  const kwh = 7.25;
  // High-entropy coordinates (not just Date.now()-derived) to avoid two runs
  // colliding on the same label text in the host's accumulated POC list.
  const lat = Number((Math.random() * 80 - 40).toFixed(4));
  const lng = Number((Math.random() * 160 - 80).toFixed(4));
  const power = 11;
  const pocLabel = `${lat}, ${lng} — ${power} kW`;

  await hostPage.goto("/");
  const hostBalanceBefore = parseBalance(await hostPage.getByTestId("balance").innerText());
  await seekerPage.goto("/");
  const seekerBalanceBefore = parseBalance(await seekerPage.getByTestId("balance").innerText());

  // Host registers a fresh POC to log the session against.
  await hostPage.goto("/dashboard/pocs");
  await submitUntilNavigated(
    hostPage,
    async () => {
      await fillStable(hostPage.getByTestId("latitude"), String(lat));
      await fillStable(hostPage.getByTestId("longitude"), String(lng));
      await fillStable(hostPage.getByTestId("powerRatingKw"), String(power));
    },
    hostPage.getByTestId("submit-button"),
    "/dashboard/pocs",
  );

  // Host logs a session against that POC, naming the seeker by email. The whole
  // select-fields-then-submit sequence is one retryable unit: a late island
  // remount can wipe the form's entire local state (pocId/seekerId/kwh) at once,
  // not just the field most recently touched, so success is gated on the real
  // outcome (the success redirect) — re-doing every field if that doesn't happen.
  await hostPage.goto("/dashboard/sessions");
  await expect(async () => {
    await selectOption(hostPage, hostPage.getByTestId("pocId"), pocLabel);
    await searchAndSelect(hostPage, hostPage.getByTestId("seekerEmail"), seekerEmail, seekerEmail);
    await fillStable(hostPage.getByTestId("kwh"), String(kwh));
    await hostPage.getByTestId("submit-button").click();
    await hostPage.waitForURL("/dashboard/sessions?success=1", { timeout: 5000 });
  }).toPass({ timeout: 45_000 });

  // Both host and seeker see the identical-amount balance/history update.
  await hostPage.goto("/");
  await seekerPage.goto("/");

  const hostBalanceAfter = parseBalance(await hostPage.getByTestId("balance").innerText());
  const seekerBalanceAfter = parseBalance(await seekerPage.getByTestId("balance").innerText());

  expect(hostBalanceAfter - hostBalanceBefore).toBeCloseTo(kwh, 2);
  expect(seekerBalanceAfter - seekerBalanceBefore).toBeCloseTo(-kwh, 2);

  await expect(hostPage.getByTestId("history-list")).toContainText(`${kwh.toFixed(2)} kWh`);
  await expect(seekerPage.getByTestId("history-list")).toContainText(`${kwh.toFixed(2)} kWh`);

  await hostContext.close();
  await seekerContext.close();
});
