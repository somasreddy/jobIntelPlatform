import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    passWithNoTests: true,
    // Playwright's e2e/*.spec.ts files match Vitest's default test glob but
    // use Playwright's own test.describe()/test() APIs — exclude them here so
    // Vitest doesn't try (and fail) to collect them as its own tests.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
