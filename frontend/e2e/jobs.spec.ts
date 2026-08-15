import { test, expect } from "@playwright/test";

/**
 * app/jobs/page.tsx - the dork-powered job search page.
 *
 * On mount it fires an initial GET against /api/jobs; if that is empty or
 * unreachable it falls back to an empty jobs list and the "No jobs loaded
 * yet" state, so this spec only asserts on structure that is present
 * either way: the search form fields (matching the real <span> label text
 * in JobsPage) and the primary "Find Latest Jobs" action, whose label reads
 * real button text from the component ("Find Latest Jobs" / "Finding
 * Latest Jobs..." while discovering/loading, per JobsPage's JSX).
 */
test.describe("Jobs page - dork-powered search", () => {
  test("loads the search form and the Find Latest Jobs control is present and clickable", async ({ page }) => {
    await page.goto("/jobs");

    // The App Router error boundary (app/error.tsx) is the concrete signal
    // of a page-level render crash; Next's <nextjs-portal> dev-tools
    // indicator is present on every dev-mode load regardless of errors, so
    // it isn't checked here.
    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    await expect(page.getByRole("heading", { name: /find jobs/i })).toBeVisible();
    await expect(page.getByText("Job search and filters")).toBeVisible();

    // Search form fields, addressed by the real <span> label text each
    // <input> is nested under in JobsPage.
    await expect(page.getByLabel("Title")).toBeVisible();
    await expect(page.getByLabel("Experience")).toBeVisible();
    await expect(page.getByLabel("Location")).toBeVisible();
    await expect(page.getByLabel("Country")).toBeVisible();
    await expect(page.getByLabel("Skills / technologies")).toBeVisible();

    const findButton = page.getByRole("button", { name: /find latest jobs/i });
    await expect(findButton).toBeVisible();
    // The page runs its own initial fetch on mount, which disables this
    // button and swaps its label to "Finding Latest Jobs..." until it
    // settles - wait that out before interacting with it.
    await expect(findButton).toBeEnabled({ timeout: 15000 });

    await findButton.click();

    // Clicking flips the same button into its in-flight label - this must
    // hold regardless of whether the backend/live search is reachable.
    await expect(page.getByRole("button", { name: /finding latest jobs/i })).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});
