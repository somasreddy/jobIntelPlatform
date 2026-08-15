import { defineConfig, devices } from "@playwright/test";

/**
 * Minimal Playwright config for the Next.js frontend.
 * Starting scaffold: chromium only, no cross-browser matrix yet.
 *
 * Spins up the local dev server (npm run dev, from this frontend/ directory)
 * and waits for it to answer on http://localhost:3000 before running tests.
 * When a dev server is already running locally, it is reused instead of
 * starting a second one.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Wider than devices["Desktop Chrome"]'s default 1280x720: at 1280px
        // wide, the app's fixed right-hand ProfileSidebar (rendered globally
        // in app/layout.tsx, "hidden xl:flex") overlaps the Command Center
        // page's content because that page doesn't reserve margin for it
        // the way app/jobs/page.tsx does ("xl:mr-72") - see report for
        // details. 1920x1080 is clear of that overlap.
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
