import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// The suite talks to MySQL directly for fixtures and teardown. Next loads
// `.env` for the dev server, but the Playwright process is separate and gets
// nothing — without this, every Prisma call fails on a missing DATABASE_URL.
loadEnv();

/**
 * UAT — two projects.
 *
 * `admin` is the automated counterpart to docs/handover/admin-e2e-test-guide.md.
 * `student` covers the B2C shell consolidation: one shell, one-time onboarding,
 * post-login lands on Home, and no cross-class leak. It creates its own
 * student and needs no fixtures from the admin run, so it can be run on its
 * own with `--project=student`.
 *
 * `workers: 1` is not a performance oversight. Every spec mutates one shared
 * MySQL database, so two workers would race each other's fixtures and the
 * failures would be timing, not truth. The suite is a journey, and journeys run
 * in order.
 *
 * `fullyParallel: false` + file ordering means 00-p0 runs first: it prices the
 * CBSE rows, which several later specs read as a precondition.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/artifacts/_runner",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e/artifacts/admin/results.json" }]],
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // Next's dev server compiles a route the first time it is hit, which can
    // take several seconds. These are sized for that, not for a warm server.
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "admin",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      testMatch: /admin\/.*\.spec\.ts/,
    },
    {
      // B2C student flow. No `storageState` and no dependency: these specs
      // sign in themselves, because *where a login lands* is one of the
      // things under test — a pre-seeded session would skip the assertion —
      // and they create their own student, so they can run standalone with
      // `--project=student`.
      name: "student",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /student\/.*\.spec\.ts/,
    },
  ],

  globalTeardown: "./e2e/global-teardown.ts",

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
