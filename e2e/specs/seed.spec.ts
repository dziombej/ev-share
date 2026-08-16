// The exemplar every generated E2E test in this project is modeled on (see
// .claude/skills/10x-e2e/references/seed-test-pattern.md — "what you show is
// what you get"). Demonstrates the four required patterns: role-based
// locators (getByLabel/getByRole/getByText, never CSS/XPath/data-testid where
// an accessible attribute already disambiguates), a full independent
// setup -> action -> assert -> cleanup cycle, waiting for real application
// state instead of a timeout, and a test name bound to the behavior it
// protects rather than "test 1".
//
// Runs under the default "chromium" project, authenticated via the
// storageState saved by e2e/auth.setup.ts (same session-reuse convention as
// dashboard-session.spec.ts).
import { test, expect } from "@playwright/test";
import { fillStable } from "../utils";

test("a registered charging point persists after reload and can be removed", async ({ page }) => {
  // Unique per run so parallel runs and re-runs never collide with the
  // authenticated host's other charging points in the shared list.
  const lat = Number((Math.random() * 80 - 40).toFixed(4));
  const lng = Number((Math.random() * 160 - 80).toFixed(4));
  const power = 22;
  const coords = `${lat}, ${lng}`;

  await page.goto("/dashboard/pocs");
  await fillStable(page.getByLabel("Latitude"), String(lat));
  await fillStable(page.getByLabel("Longitude"), String(lng));
  await fillStable(page.getByLabel("Power rating (kW)"), String(power));
  await page.getByRole("button", { name: "Register POC" }).click();
  await page.waitForURL("/dashboard/pocs");

  await expect(page.getByText(coords)).toBeVisible();

  // Reload to prove this is real, persisted state — not just optimistic
  // client-side UI that would vanish on a fresh page load.
  await page.reload();
  await expect(page.getByText(coords)).toBeVisible();

  // Cleanup: remove the POC this test created so it doesn't linger for the
  // next run. Newest-first ordering (listPocsForOwner) means it's always the
  // first "Remove" button in the list.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Remove" }).first().click();

  await expect(page.getByText(coords)).toHaveCount(0);
});
