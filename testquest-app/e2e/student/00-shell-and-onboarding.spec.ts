import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../helpers/db";
import {
  STUDENT_PASSWORD, createFreshStudent, pickTwoPopulatedScopes,
} from "../helpers/student";

/**
 * The four promises of the shell consolidation, as one journey:
 *
 *   1. Post-login lands on **Home** — never on a browse-all page.
 *   2. Onboarding is asked **once, ever**, gated on `tq_student_contexts`.
 *   3. There is **one shell** — the header is identical on every student page.
 *   4. **No cross-class leak** — nothing shows another class's content.
 *
 * Ordered, single-worker, one shared database: the state each step leaves is
 * the next step's precondition, which is also what makes "asked once, ever"
 * testable at all — it needs a student who has genuinely been through it.
 */

let email: string;

/** The shell's fingerprint: the switcher plus all three nav destinations. */
async function expectOneShell(page: Page) {
  await expect(page.getByTestId("context-switcher")).toBeVisible();
  const nav = page.getByTestId("student-nav");
  await expect(nav.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "My progress" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "My subscriptions" })).toBeVisible();
  // The retired tabs must not come back anywhere.
  await expect(nav.getByRole("link", { name: "All tests" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "History" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', STUDENT_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for the post-login redirect to actually resolve. Navigating on before
  // it does races the session cookie and bounces straight back to /login,
  // which looks like a routing bug but is a test bug.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test.beforeAll(async () => {
  const student = await createFreshStudent("shell");
  email = student.email;
});

test.describe.configure({ mode: "serial" });

test("a student with no context is sent to onboarding, not to a browse page", async ({ page }) => {
  await login(page);

  // The whole point of fix #2: the old default was /tests. A student with zero
  // contexts must reach onboarding no matter which route they entered by.
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /which board/i })).toBeVisible();
});

test("entering through any other route still cannot skip onboarding", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 });

  // This is the bug that made onboarding feel un-persisted: the legacy entry
  // path never consulted contexts. Every one of these must now bounce.
  for (const route of ["/progress", "/my-subscriptions", "/profile", "/my-attempts"]) {
    await page.goto(route);
    await expect(page, `${route} must not render for a context-less student`)
      .toHaveURL(/\/onboarding/, { timeout: 30_000 });
  }
});

test("completing onboarding lands on Home in the one shell", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 });

  // Board → Class → Skip the optional second class.
  await page.locator("button", { hasText: /./ }).first().waitFor();
  await page.getByRole("button", { name: /continue/i }).waitFor();
  await page.locator('button:below(:text("Which board"))').first().click();
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page.getByRole("heading", { name: /which class/i })).toBeVisible();
  await page.locator('div.grid > button:not([disabled])').first().click();
  await page.getByRole("button", { name: /continue/i }).click();

  await page.getByRole("button", { name: /^skip$/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expectOneShell(page);

  // It actually persisted — the gate reads this table and nothing else.
  const count = await prisma.studentContext.count({
    where: { student: { email } },
  });
  expect(count).toBeGreaterThan(0);
});

test("logging in again lands on Home — onboarding is never asked twice", async ({ page }) => {
  await login(page);

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/onboarding/);
  await expectOneShell(page);

  // And a direct visit to onboarding bounces back out rather than re-asking.
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
});

test("the header is identical on every student page", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  for (const route of ["/dashboard", "/progress", "/my-subscriptions", "/profile"]) {
    await page.goto(route);
    await expectOneShell(page);
  }
});

test("History is folded into My progress", async ({ page }) => {
  await login(page);

  await page.goto("/my-attempts");
  await expect(page).toHaveURL(/\/progress/, { timeout: 30_000 });
  await expect(page.getByTestId("recent-attempts")).toBeVisible();
  await expectOneShell(page);
});

test("the cross-class browse is gone and cannot be reached", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  // The browse-all page itself is retired.
  const res = await page.goto("/tests");
  expect(res?.status(), "/tests browse-all must no longer serve a page").toBe(404);
});

test("the tests API is scoped to the active context and cannot be widened", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  const scopes = await pickTwoPopulatedScopes();
  test.skip(!scopes, "needs two populated board+class scopes to prove scoping");

  const ctx = await prisma.studentContext.findFirst({
    where: { student: { email } },
    select: { boardId: true, classId: true },
  });
  expect(ctx).not.toBeNull();

  // The other class — whichever of the two the student is *not* in.
  const other = scopes!.a.classId === ctx!.classId ? scopes!.b : scopes!.a;

  // Ask for the other class explicitly. The params are no longer read, so the
  // answer must still be this student's own scope.
  const body = await page.evaluate(async (o) => {
    const r = await fetch(`/api/tests?classId=${o.classId}&boardId=${o.boardId}&limit=50`);
    return r.json();
  }, { classId: other.classId, boardId: other.boardId });

  expect(body.ok).toBe(true);
  const leaked = (body.data.tests as Array<{ class: { id: number } | null }>)
    .filter((t) => t.class && t.class.id !== ctx!.classId);
  expect(leaked, "no test from another class may appear").toEqual([]);
});

test("an unauthenticated caller gets no catalogue at all", async ({ browser }) => {
  // A fresh context — no session cookie. The endpoint used to answer this
  // with every class's tests.
  const anon = await browser.newContext();
  const res = await anon.request.get("/api/tests?limit=50");
  expect(res.status(), "signed-out catalogue must not be readable").toBeGreaterThanOrEqual(400);
  await anon.close();
});

test("a subject page outside the student's classes is not found", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  const held = await prisma.studentContext.findMany({
    where: { student: { email } },
    select: { boardId: true, classId: true },
  });
  const outOfScope = await prisma.offering.findFirst({
    where: {
      isActive: true,
      NOT: held.map((h) => ({ boardId: h.boardId, classId: h.classId })),
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  test.skip(!outOfScope, "every offering is in this student's classes");

  // Typing an offering id used to render another class's subject page — locked,
  // but named, and under a header claiming a different class. Out of scope must
  // be indistinguishable from nonexistent.
  const body = await page.evaluate(async (id) => {
    const r = await fetch(`/api/offerings/${id}`);
    return { status: r.status, json: await r.json() };
  }, outOfScope!.id);

  expect(body.status).toBe(404);
  expect(body.json.ok).toBe(false);
});

test("Home renders real per-class counts and a free-sample CTA (1d)", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  const ctx = await prisma.studentContext.findFirst({
    where: { student: { email } }, select: { boardId: true, classId: true },
  });
  const [subjects, tests] = await Promise.all([
    prisma.offering.count({ where: { boardId: ctx!.boardId, classId: ctx!.classId, isActive: true } }),
    prisma.test.count({
      where: { isActive: true, offering: { boardId: ctx!.boardId, classId: ctx!.classId, isActive: true } },
    }),
  ]);
  test.skip(subjects === 0, "class has no published subjects");

  // The banner's figures must be this class's, from the API — not a mock's
  // "30 video lessons". Counting them here is the only way to know they are.
  const banner = page.getByText(/All \d+ subjects? · \d+ chapter-wise tests?/);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(`All ${subjects} subject`);
  await expect(banner).toContainText(`${tests} chapter-wise test`);

  // An unsubscribed class leads with its free samples, not with a price.
  await expect(page.getByRole("link", { name: /Try your free .* test/ }).first()).toBeVisible();
  await expect(page.getByText(/₹\s*(?![\d])/)).toHaveCount(0);
});

test("every next-test suggestion belongs to the active class (gap 2)", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  const home = await page.evaluate(async () => (await fetch("/api/student/home")).json());
  expect(home.ok).toBe(true);

  const ctx = await prisma.studentContext.findFirst({
    where: { student: { email } }, select: { boardId: true, classId: true },
  });
  const suggested = (home.data.subjects as Array<{ nextTest: { id: number } | null }>)
    .map((s) => s.nextTest?.id)
    .filter((id): id is number => id != null);
  test.skip(suggested.length === 0, "no unattempted tests to suggest");

  // A suggestion is a link into content: it must never name another class's
  // paper, the same rule the browse list is held to.
  const foreign = await prisma.test.count({
    where: {
      id: { in: suggested },
      NOT: { offering: { boardId: ctx!.boardId, classId: ctx!.classId } },
    },
  });
  expect(foreign, "no suggested test may come from another class").toBe(0);
});

test("the attempts subject filter narrows within scope and cannot widen it (gap 3)", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  const ctx = await prisma.studentContext.findFirst({
    where: { student: { email } }, select: { boardId: true, classId: true },
  });
  const foreign = await prisma.offering.findFirst({
    where: { isActive: true, NOT: { boardId: ctx!.boardId, classId: ctx!.classId } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  test.skip(!foreign, "needs an offering outside this student's class");

  // Passing another class's offering must intersect to nothing, not switch the
  // list to that class. Fail closed, exactly like the catalogue.
  const body = await page.evaluate(async (id) => {
    const r = await fetch(`/api/student/attempts?offeringId=${id}&limit=50`);
    return r.json();
  }, foreign!.id);

  expect(body.ok).toBe(true);
  expect(body.data.attempts).toEqual([]);
  expect(body.data.total).toBe(0);
});

test("My subscriptions shows a free-browsing card for a class with no pass (1g)", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  // This student has never bought anything, so every class they hold is a
  // free-browsing one — the case that previously rendered no card at all.
  await page.goto("/my-subscriptions");
  const freeCard = page.getByTestId("free-class-card").first();
  await expect(freeCard).toBeVisible();
  await expect(freeCard).toContainText(/Free browsing — no pass yet/);
  await expect(freeCard.getByText("Free", { exact: true })).toBeVisible();

  // The doorway quotes the real cheapest term when one is priced.
  const ctx = await prisma.studentContext.findFirst({
    where: { student: { email } }, select: { boardId: true, classId: true },
  });
  const cheapest = await prisma.b2cPlan.findFirst({
    where: { boardId: ctx!.boardId, classId: ctx!.classId, subjectId: null, isActive: true },
    orderBy: { price: "asc" },
    select: { price: true },
  });
  const cta = freeCard.getByRole("button", { name: /See plans/ });
  await expect(cta).toBeVisible();
  if (cheapest) await expect(cta).toContainText(`₹${Number(cheapest.price)}`);

  await expectOneShell(page);
});

test("＋ Add a class opens a sheet in place — it never navigates", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  await page.getByTestId("context-switcher").click();
  const add = page.getByTestId("add-class");
  await expect(add).toBeVisible();
  await add.click();

  // 2a is one sheet, not a route: the URL must not move, and the confirm CTA
  // starts disabled because nothing is picked yet.
  const sheet = page.getByRole("dialog", { name: /add a class/i });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard/);
  const confirm = page.getByTestId("add-class-confirm");
  await expect(confirm).toBeDisabled();
  await expect(confirm).toContainText(/pick a class/i);

  // Closing returns the student exactly where they were.
  await sheet.getByRole("button", { name: /close/i }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("the retired /onboarding?add=1 route no longer adds a class", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  // The three-step add flow is gone; onboarding is first-run only, so an
  // onboarded student hitting it — with or without the old flag — bounces home
  // rather than getting a second way to add.
  await page.goto("/onboarding?add=1");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
});

test("adding a class from the sheet lands on that class's Home", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  const before = await prisma.studentContext.findMany({
    where: { student: { email } },
    select: { classId: true },
  });
  const heldIds = before.map((c) => c.classId);

  await page.getByTestId("context-switcher").click();
  await page.getByTestId("add-class").click();
  const sheet = page.getByRole("dialog", { name: /add a class/i });
  await expect(sheet).toBeVisible();

  // A class they already hold must be offered as disabled, never hidden and
  // never an error.
  const held = sheet.locator("button[disabled]", { hasText: /already added/i });
  await expect(held.first()).toBeVisible();

  // Pick the first addable class.
  const addable = sheet.locator("button:not([disabled])", { hasText: /^Class \d+/ }).first();
  await expect(addable).toBeVisible();
  const chosen = (await addable.innerText()).split("\n")[0].trim();
  await addable.click();

  const confirm = page.getByTestId("add-class-confirm");
  await expect(confirm).toBeEnabled();
  // Give the summary fetch time to land so the CTA is asserted in its final
  // form — it names the pick and, when the class has samples, offers them.
  await expect(confirm).toContainText(new RegExp(`Add ${chosen}\\b`));
  await confirm.click();

  // Lands on Home, quietly, in the same one shell. The URL does not change
  // (the sheet opened over /dashboard), so waiting on it would pass instantly
  // while the POST is still in flight. The pill is the real signal: it only
  // reads the new class once the context is written, made active, and the
  // page has reloaded.
  await expect(page.getByTestId("context-switcher")).toContainText(chosen, { timeout: 30_000 });
  await expect(sheet).toBeHidden();
  await expectOneShell(page);

  // The new context persisted and is the active one the header now shows.
  const after = await prisma.studentContext.findMany({
    where: { student: { email } },
    select: { classId: true },
  });
  expect(after.length).toBe(before.length + 1);
  const added = after.map((c) => c.classId).find((id) => !heldIds.includes(id));
  expect(added).toBeDefined();
});
