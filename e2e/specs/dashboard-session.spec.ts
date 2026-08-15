import { test, expect } from "@playwright/test";

// Runs under the default "chromium" project, authenticated via the storageState
// saved by e2e/auth.setup.ts — proves the session-reuse convention future
// protected-route specs (S-01/S-02/S-03) will build on.
test("dashboard is directly reachable with a saved session", async ({ page }) => {
  const email = process.env.E2E_USERNAME;
  if (!email) {
    throw new Error("E2E_USERNAME must be set (see .env.test.example)");
  }

  await page.goto("/dashboard");

  await expect(page.getByTestId("dashboard-welcome")).toContainText(email);
});
