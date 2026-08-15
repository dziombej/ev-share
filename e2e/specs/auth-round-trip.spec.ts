import { test, expect } from "@playwright/test";
import { fillStable } from "../utils";

// Opt out of the project's default authenticated storageState — this spec
// must start from a clean, logged-out browser context to exercise signup.
test.use({ storageState: { cookies: [], origins: [] } });

function uniqueEmail() {
  return `e2e-round-trip-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

test("full auth round trip: signup, signin, dashboard, signout", async ({ page }) => {
  const email = uniqueEmail();
  const password = "Str0ngTestPassw0rd!";

  await page.goto("/auth/signup");
  await fillStable(page.getByTestId("email"), email);
  await fillStable(page.getByTestId("password"), password);
  await fillStable(page.getByTestId("confirmPassword"), password);
  await page.getByTestId("submit-button").click();

  await page.waitForURL("/auth/confirm-email");
  await expect(page.getByRole("heading", { name: "Registration successful" })).toBeVisible();

  await page.getByRole("link", { name: "Go to sign in" }).click();
  await page.waitForURL("/auth/signin");

  await fillStable(page.getByTestId("email"), email);
  await fillStable(page.getByTestId("password"), password);
  await page.getByTestId("submit-button").click();
  await page.waitForURL("/");

  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-welcome")).toContainText(email);

  await page.getByTestId("signout-button").click();
  await page.waitForURL("/");

  // Middleware should now block access to the protected route again.
  await page.goto("/dashboard");
  await page.waitForURL("/auth/signin");
});
