import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.pw.mjs",
  outputDir: ".cache/playwright",
  reporter: "line",
  fullyParallel: true,
  use: { browserName: "chromium", headless: true },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 360, height: 800 } } },
  ],
});
