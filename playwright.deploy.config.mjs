import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/deploy",
  testMatch: "**/*.pw.mjs",
  outputDir: ".cache/playwright-deploy",
  reporter: "line",
  workers: 1,
  retries: 0,
  timeout: 120000,
  use: {
    baseURL: process.env.BASE_URL,
    browserName: "chromium",
    headless: true,
    timezoneId: "Europe/Moscow",
    viewport: { width: 1280, height: 900 },
    actionTimeout: 15000,
  },
});
