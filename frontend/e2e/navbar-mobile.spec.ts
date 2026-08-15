import { test, expect } from "@playwright/test";

/**
 * components/Navbar.tsx - mobile drawer behavior.
 *
 * Below the md breakpoint the <aside> sidebar is translated off-screen
 * (`-translate-x-full`) and a hamburger button (aria-label="Open menu")
 * appears in a fixed mobile header. Tapping it sets mobileOpen=true, which
 * both slides the sidebar in (`translate-x-0`) and mounts a backdrop
 * overlay (a conditionally-rendered `div.fixed.inset-0.z-40` - see
 * Navbar.tsx). The drawer's own close button (aria-label="Close menu")
 * reverses both.
 */
test.describe("Navbar mobile drawer", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens via the hamburger button and closes via its close button", async ({ page }) => {
    await page.goto("/");

    const aside = page.locator("aside").first();
    const backdrop = page.locator("div.fixed.inset-0.z-40");

    // Closed by default on a mobile viewport.
    await expect(aside).toHaveClass(/-translate-x-full/);
    await expect(backdrop).toHaveCount(0);

    await page.getByRole("button", { name: "Open menu" }).click();

    await expect(aside).not.toHaveClass(/-translate-x-full/);
    await expect(backdrop).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
    await expect(page.getByText("JobIntel AI").first()).toBeVisible();

    await page.getByRole("button", { name: "Close menu" }).click();

    await expect(aside).toHaveClass(/-translate-x-full/);
    await expect(backdrop).toHaveCount(0);
  });
});
