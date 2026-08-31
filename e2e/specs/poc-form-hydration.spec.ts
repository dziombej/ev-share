// Guards a progressive-enhancement property of the registration form: what a
// user types before the Astro island finishes hydrating must survive hydration.
//
// The failure this protects against is silent. A *controlled* React island
// (`value={state}` over an empty `useState("")`) re-applies its own empty state
// to the DOM node when it mounts, discarding anything already typed. The user
// sees their input vanish; a fast agent (or an e2e run) then submits a form
// whose fields were blanked, and client-side validation rejects it with
// preventDefault() — so nothing ever reaches the server.
//
// Hydration is gated deterministically here rather than being raced: every
// script request is held until the fields are filled, so "typed before
// hydration" is guaranteed rather than ~50% likely.
import { test, expect } from "@playwright/test";
import { removePocByCoords, waitForIslandsHydrated } from "../utils";

test("input typed before the form hydrates survives hydration and still registers the POC", async ({ page }) => {
  const lat = Number((Math.random() * 80 - 40).toFixed(4));
  const lng = Number((Math.random() * 160 - 80).toFixed(4));
  const power = 7;
  const coords = `${lat}, ${lng}`;

  let releaseScripts!: () => void;
  const scriptsGate = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });

  // Held by resourceType rather than a URL glob: in dev the island arrives as
  // .tsx, and its deps as .js from several different paths.
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "script") {
      await scriptsGate;
    }
    await route.continue();
  });

  // "commit" — waiting for load would deadlock against the gate above.
  await page.goto("/dashboard/pocs", { waitUntil: "commit" });

  // Server-rendered HTML only: no React has run yet.
  await page.getByLabel("Latitude").fill(String(lat));
  await page.getByLabel("Longitude").fill(String(lng));
  await page.getByLabel("Power rating (kW)").fill(String(power));

  releaseScripts();
  await waitForIslandsHydrated(page);

  await expect(page.getByLabel("Latitude")).toHaveValue(String(lat));
  await expect(page.getByLabel("Longitude")).toHaveValue(String(lng));
  await expect(page.getByLabel("Power rating (kW)")).toHaveValue(String(power));

  // The values surviving in the DOM is only half of it: the component's own
  // validation must also see them, or it silently blocks the submit.
  await page.getByRole("button", { name: "Register POC" }).click();
  await expect(page.getByText(coords)).toBeVisible();

  // Cleanup. Unlike filling the form, removing genuinely needs the island to be
  // live — "Remove" is an onClick fetch handler with no server-rendered
  // fallback.
  await waitForIslandsHydrated(page);
  await removePocByCoords(page, coords);
});
