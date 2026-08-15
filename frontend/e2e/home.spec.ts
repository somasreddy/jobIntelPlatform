import { test, expect } from "@playwright/test";

/**
 * app/page.tsx - the Command Center / dashboard home page.
 *
 * The page fetches career-graph, funnel, jobs, learning-path, and campaign
 * data in parallel via Promise.allSettled and gracefully degrades to a
 * built-in empty/onboarding state per-section when a fetch fails or the
 * backend is unreachable (see buildLocalHealth/buildProfileTodos/etc. and
 * the "No matched jobs loaded yet" / "No applications tracked" fallbacks
 * in app/page.tsx). These assertions therefore target structure that is
 * present in both the populated and the empty state, not specific values.
 */
test.describe("Command Center (home page)", () => {
  test("loads and renders its structure without a JS error overlay", async ({ page }) => {
    await page.goto("/");

    // Note: Next.js dev mode always mounts a <nextjs-portal> custom element
    // (it hosts the persistent "Open Next.js Dev Tools" indicator, not just
    // error UI - confirmed present on a clean load during manual test runs),
    // so its mere presence is not a useful signal here. The App Router
    // error boundary (app/error.tsx) is the concrete, unambiguous signal of
    // a page-level render crash - it must be absent.
    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    // Header. Scoped to <main> - the Navbar also has a nav link with this
    // same label ("Command Center" is both the page's eyebrow text here and
    // the home nav item's label), so an unscoped locator is ambiguous.
    await expect(page.getByRole("main").getByText("Command Center", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What to do next" })).toBeVisible();
    await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible();

    // Career readiness ring + label always renders (health is either real
    // API data or the locally-derived fallback from buildLocalHealth).
    await expect(page.getByText("Career readiness")).toBeVisible();

    // Section headers that render regardless of whether their data is
    // populated or empty.
    for (const heading of ["Today", "Learning focus", "Job matches", "Pipeline", "Useful tools"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }

    // "Useful tools" quick links are static and always present.
    await expect(page.getByRole("link", { name: /interview prep/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /market radar/i })).toBeVisible();
  });

  test("Refresh control can be clicked without crashing", async ({ page }) => {
    await page.goto("/");

    const refreshButton = page.getByRole("button", { name: /refresh/i });
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Whether the refetch succeeds or fails (no backend), the page must
    // settle back to its normal state with no crash overlay.
    await expect(page.getByRole("heading", { name: "What to do next" })).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});
