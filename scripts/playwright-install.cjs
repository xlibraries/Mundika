const path = require("node:path");
const { execSync } = require("node:child_process");

const browsers = path.join(
  __dirname,
  "..",
  "node_modules",
  ".cache",
  "ms-playwright"
);
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsers };
execSync("npx playwright install chromium", { stdio: "inherit", env });
