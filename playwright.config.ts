import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// One stable directory for both `playwright install` and `playwright test`.
// (Sandboxed agents may set PLAYWRIGHT_BROWSERS_PATH to a temp folder that
// does not match where tests resolve browsers.)
const localBrowsers = path.join(
  process.cwd(),
  "node_modules",
  ".cache",
  "ms-playwright"
);
process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
