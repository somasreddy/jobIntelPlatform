import { test, expect } from "@playwright/test";

/**
 * components/Navbar.tsx + components/ThemeSelector.tsx + lib/theme.ts
 *
 * The sidebar footer has a button labeled with the active theme's name
 * (defaults to "Executive", the DEFAULT_THEME "executive" entry in
 * lib/theme.ts) that toggles the ThemeSelector popover. Picking a theme
 * calls setTheme(), which sets `data-theme` on document.documentElement
 * (see ThemeProvider.tsx) - the actual mechanism the whole app's CSS
 * theming depends on.
 */
test.describe("Theme picker", () => {
  test("opens from the sidebar and updates data-theme on <html> when a theme is selected", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "executive");

    const themeButton = page.getByRole("button", { name: "Executive" });
    await expect(themeButton).toBeVisible();
    await themeButton.click();

    // ThemeSelector popover content (real copy from ThemeSelector.tsx).
    await expect(page.getByText("Choose a focused enterprise workspace.")).toBeVisible();

    const graphiteOption = page.getByRole("button", { name: /Graphite/ });
    await expect(graphiteOption).toBeVisible();
    await graphiteOption.click();

    await expect(html).toHaveAttribute("data-theme", "graphite");
  });
});
