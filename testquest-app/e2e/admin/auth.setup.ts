import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Log in once, reuse the session everywhere.
 *
 * Going through the real form rather than forging a cookie means the login
 * screen itself is covered, and it is the one place the suite proves the auth
 * gate works before assuming it does.
 */
const AUTH_FILE = "e2e/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  mkdirSync("e2e/.auth", { recursive: true });

  // Signed-out access to a protected page must bounce (Part 3, "direct URL
  // access while logged out"). Asserted here so it is checked before a session
  // exists, which is the only moment it can be.
  await page.goto("/admin/plans");
  await expect(page).toHaveURL(/\/admin\/login/, { timeout: 30_000 });

  await page.fill('input[type="email"]', "admin@testquest.in");
  await page.fill('input[type="password"]', "admin123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/admin(?!\/login)/, { timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
