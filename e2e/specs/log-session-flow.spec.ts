import { test, expect, type Locator, type Page } from "@playwright/test";
import { fillStable } from "../utils";

// Radix Select's trigger occasionally doesn't visibly open on the first synthetic
// click under Playwright — retry the open until the target option is visible,
// matching how fillStable retries against the same class of UI-timing flakiness.
async function selectOption(page: Page, trigger: Locator, optionName: string) {
  const option = page.getByRole("option", { name: optionName });
  await expect(async () => {
    await trigger.click();
    await option.waitFor({ state: "visible", timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await option.click();
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
  await fillStable(hostPage.getByTestId("latitude"), String(lat));
  await fillStable(hostPage.getByTestId("longitude"), String(lng));
  await fillStable(hostPage.getByTestId("powerRatingKw"), String(power));
  await hostPage.getByTestId("submit-button").click();
  await hostPage.waitForURL("/dashboard/pocs");

  // Host logs a session against that POC, naming the seeker by email.
  await hostPage.goto("/dashboard/sessions");
  await selectOption(hostPage, hostPage.getByTestId("pocId"), pocLabel);
  await fillStable(hostPage.getByTestId("seekerEmail"), seekerEmail);
  await hostPage.getByRole("option", { name: seekerEmail }).click();
  await fillStable(hostPage.getByTestId("kwh"), String(kwh));
  await hostPage.getByTestId("submit-button").click();
  await hostPage.waitForURL("/dashboard/sessions?success=1");

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
