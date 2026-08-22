import { test, expect, type Page } from "@playwright/test";
import { shot } from "../helpers/shot";
import { tag } from "../helpers/db";

/**
 * Part 0 — the risks the guide says to confirm before anything else.
 *
 * The headline one: pricing a plan must move the readiness count on BOTH the
 * Launch-readiness page and the Dashboard, with no manual reload. Those two
 * screens render the same number in different shapes ("26 of 30" vs "26/30"),
 * so both are parsed to integers and compared — a mismatch means one of them
 * is reading a stale source.
 */

/** "26 of 30 offerings ready to sell" → { ready: 26, total: 30 } */
async function readinessFromHome(page: Page) {
  await page.goto("/admin");
  const sub = page.locator("text=/\\d+ of \\d+ offerings ready/").first();
  await expect(sub).toBeVisible({ timeout: 45_000 });
  const m = (await sub.textContent())!.match(/(\d+) of (\d+)/)!;
  return { ready: Number(m[1]), total: Number(m[2]) };
}

/** Dashboard tile renders "26/30". */
async function readinessFromDashboard(page: Page) {
  await page.goto("/admin/dashboard");
  const tile = page.locator("text=/^\\d+\\/\\d+$/").first();
  await expect(tile).toBeVisible({ timeout: 45_000 });
  const m = (await tile.textContent())!.match(/(\d+)\/(\d+)/)!;
  return { ready: Number(m[1]), total: Number(m[2]) };
}

test.describe("Part 0 — the four suspicions", () => {
  test("P0.1 pricing CBSE rows moves readiness on BOTH home and dashboard, no manual reload", async ({ page }) => {
    const before = await readinessFromHome(page);
    await shot(page, "p0-readiness-before");

    // Price every CBSE row that has offerings, through the grid's own bulk
    // controls — the same path an admin uses.
    await page.goto("/admin/plans");
    // Scoped to the page's readiness strip, not the sidebar's "Launch
    // readiness" nav link. A bare getByText matched both and aborted the test
    // on a strict-mode violation before any of the assertions below ran.
    // The strip holds the label as a *direct child span of a div*; the nav
    // item's span sits inside an <a>. The copy filter pins it further.
    const readinessStrip = page
      .locator('div:has(> span:text-is("Launch readiness"))')
      .filter({ hasText: /offerings ready to sell/ });
    await expect(readinessStrip).toBeVisible({ timeout: 45_000 });

    const firstPrice = page.locator('input[aria-label$="3 month price"]').first();
    await expect(firstPrice).toBeVisible();

    // "Save all changes" is enabled only for rows whose draft differs from what
    // is stored. A hard-coded 499 therefore made this test pass exactly once:
    // the run after it, the stored price was already 499, nothing was dirty,
    // Save stayed disabled and the whole recompute assertion below never ran.
    // Alternate against the current value so every run makes a real edit.
    const current = Number((await firstPrice.inputValue()).replace(/[^\d]/g, "")) || 0;
    const nextPrice = current === 499 ? 599 : 499;
    await firstPrice.fill(String(nextPrice));

    await page.getByRole("button", { name: /fill every row/i }).click();
    await shot(page, "p0-plans-filled");

    const saveAll = page.getByRole("button", { name: /save all changes/i });
    await expect(saveAll).toBeEnabled();
    await saveAll.click();

    // The strip is refetched from /api/admin/launch-readiness after the save —
    // this is the "recomputes without a reload" claim, asserted in place.
    await expect(readinessStrip).toContainText(/\d+ of \d+\s*offerings ready to sell/, { timeout: 45_000 });
    await page.waitForFunction(
      (prev) => {
        const el = [...document.querySelectorAll("*")].find((n) => /\d+ of \d+/.test(n.textContent ?? "") && n.children.length === 0);
        const m = el?.textContent?.match(/(\d+) of (\d+)/);
        return !!m && Number(m[1]) > prev;
      },
      before.ready,
      { timeout: 45_000 },
    ).catch(() => { /* already at max, asserted below */ });
    await shot(page, "p0-plans-saved-readiness-strip");

    const home = await readinessFromHome(page);
    await shot(page, "p0-readiness-after-home");
    const dash = await readinessFromDashboard(page);
    await shot(page, "p0-readiness-after-dashboard");

    // The heart of it: both screens agree, and pricing moved the number.
    expect(home.total).toBe(dash.total);
    expect(home.ready).toBe(dash.ready);
    expect(home.ready).toBeGreaterThan(0);
    expect(home.ready).toBeGreaterThanOrEqual(before.ready);
  });

  test("P0.4 a percentage coupon can be created (PERCENTAGE→PERCENT fix)", async ({ page }) => {
    await page.goto("/admin/coupons");
    await page.getByRole("button", { name: /new coupon|create coupon|new/i }).first().click();

    const code = tag("PCT").toUpperCase().slice(0, 20);
    await page.getByPlaceholder("WELCOME50").fill(code);

    // The type select carries the DB enum value; if the UI still said
    // "PERCENTAGE" this would send an invalid enum and the API would 400.
    const typeSelect = page.locator("select").filter({ hasText: /percentage off/i }).first();
    await typeSelect.selectOption("PERCENT");

    // Create stays disabled until both dates are set — the guide's "what field
    // is it waiting on?" question, answered.
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill("2026-01-01");
    await dates.nth(1).fill("2026-12-31");

    const create = page.getByRole("button", { name: /^create$/i });
    await expect(create).toBeEnabled();

    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/coupons") && r.request().method() === "POST"),
      create.click(),
    ]);
    expect(res.status(), "percentage coupon POST must succeed").toBeLessThan(300);

    await expect(page.getByText(code)).toBeVisible({ timeout: 20_000 });
    await shot(page, "p0-coupon-percentage-created");
  });
});
