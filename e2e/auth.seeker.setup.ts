import { test as setup } from "@playwright/test";
import { fillStable, submitUntilNavigated } from "./utils";

const authFile = "playwright/.auth/seeker.json";

setup("authenticate seeker", async ({ page }) => {
  const email = process.env.E2E_SEEKER_USERNAME;
  const password = process.env.E2E_SEEKER_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_SEEKER_USERNAME / E2E_SEEKER_PASSWORD must be set (see .env.test.example)");
  }

  await page.goto("/auth/signin");
  // ev-share's sign-in redirects to "/" on success, not "/dashboard".
  await submitUntilNavigated(
    page,
    async () => {
      await fillStable(page.getByTestId("email"), email);
      await fillStable(page.getByTestId("password"), password);
    },
    page.getByTestId("submit-button"),
    "/",
  );

  await page.context().storageState({ path: authFile });
});
