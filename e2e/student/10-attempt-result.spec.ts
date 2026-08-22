import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../helpers/db";
import {
  STUDENT_PASSWORD, createFreshStudent, findFreeSampleWithQuestions,
  giveContext, grantPaidPass,
} from "../helpers/student";

/**
 * The review screen, end to end.
 *
 * This file exists because a paying student found all of it first: Back from a
 * test landed on "Subject not found", View result threw a TypeError, and
 * Submit threw the same thing on landing. Every case here is one of those
 * journeys walked the way a student walks it — sit the paper, submit it, read
 * the score — rather than a route poked in isolation.
 *
 * Ordered and single-worker, like the rest of e2e: the attempt one test
 * submits is the attempt the next one reviews.
 */

let email: string;
let studentId: number;
let sample: Awaited<ReturnType<typeof findFreeSampleWithQuestions>>;

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', STUDENT_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/**
 * Records uncaught exceptions for the life of a test.
 *
 * The original failure was a `TypeError` thrown during render, so the honest
 * signal is "did anything throw", not "does the DOM look right". Checking for
 * an error overlay would not work here either: Next's dev build always mounts
 * a `nextjs-portal` for its dev-tools indicator, error or not.
 *
 * Attach before the first navigation of a test.
 */
function watchForCrashes(page: Page): string[] {
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(e.message));
  return crashes;
}

/** Nothing threw, and no rendered error text made it to the page. */
async function expectNoPageError(page: Page, crashes: string[]) {
  expect(crashes, "the page threw during render").toEqual([]);
  await expect(page.getByText(/Cannot read properties of undefined/i)).toHaveCount(0);
  await expect(page.getByText(/Application error/i)).toHaveCount(0);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const student = await createFreshStudent("result");
  email = student.email;
  studentId = student.id;
  sample = await findFreeSampleWithQuestions();
  if (sample) await giveContext(studentId, sample.boardId, sample.classId);
});

test("back from a test page reaches its subject, not 'Subject not found'", async ({ page }) => {
  test.skip(!sample, "no free sample with questions in this database");
  await login(page);

  await page.goto(`/tests/${sample!.testId}`);
  const back = page.getByRole("link", { name: /back/i }).first();

  // The offering id and the subject id are different numbers; the link used
  // the wrong one, which rendered as the offerings page's not-found state.
  await expect(back).toHaveAttribute("href", `/offerings/${sample!.offeringId}`);

  await back.click();
  await expect(page).toHaveURL(new RegExp(`/offerings/${sample!.offeringId}$`), { timeout: 30_000 });
  await expect(page.getByText(/Subject not found/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: sample!.subjectName })).toBeVisible();
});

test("an in-progress attempt offers Resume, never View result", async ({ page }) => {
  test.skip(!sample, "no free sample with questions in this database");
  await login(page);

  // Start the paper and leave it open.
  const started = await page.evaluate(async (testId) => {
    const r = await fetch("/api/attempts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId }),
    });
    return r.json();
  }, sample!.testId);
  expect(started.ok).toBe(true);

  await page.goto(`/tests/${sample!.testId}`);

  // `percentage` is a number for every attempt, 0 included, so the card used to
  // appear for a paper that had never been scored — and the link 400'd.
  await expect(page.getByRole("link", { name: /view result/i })).toHaveCount(0);
  await expect(page.getByText(/your last attempt/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /resume attempt/i })).toBeVisible();
});

test("its result URL says 'not finished yet' and offers Resume, not a stack trace", async ({ page }) => {
  test.skip(!sample, "no free sample with questions in this database");
  const crashes = watchForCrashes(page);
  await login(page);

  const attempt = await prisma.attempt.findFirstOrThrow({
    where: { studentId, testId: sample!.testId, status: "IN_PROGRESS" },
    select: { id: true },
    orderBy: { id: "desc" },
  });

  await page.goto(`/attempts/${attempt.id}/result`);

  await expectNoPageError(page, crashes);
  await expect(page.getByText(/haven't finished this test yet/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /resume test/i })).toHaveAttribute("href", `/attempts/${attempt.id}`);
});

test("submitting lands on a result page that renders score and review", async ({ page }) => {
  test.skip(!sample, "no free sample with questions in this database");
  const crashes = watchForCrashes(page);
  await login(page);

  const attempt = await prisma.attempt.findFirstOrThrow({
    where: { studentId, testId: sample!.testId, status: "IN_PROGRESS" },
    select: { id: true },
    orderBy: { id: "desc" },
  });

  const submitted = await page.evaluate(async (id) => {
    const r = await fetch(`/api/attempts/${id}/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto: false }),
    });
    return r.json();
  }, attempt.id);
  expect(submitted.ok).toBe(true);

  await page.goto(`/attempts/${attempt.id}/result`);

  // The crash was here: every `result.summary.*` read threw because the route
  // never sent `summary`.
  await expectNoPageError(page, crashes);
  await expect(page.getByText(/of \d+ correct/i)).toBeVisible();
  await expect(page.getByText("Correct", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Incorrect", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Skipped", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/question-by-question review/i)).toBeVisible();

  // The tiles are a partition of the paper — they must add up to what the
  // headline claims.
  const tiles = await page.evaluate(() => {
    const nums = [...document.querySelectorAll("p")]
      .filter((p) => /^\d+$/.test(p.textContent!.trim()))
      .map((p) => Number(p.textContent!.trim()));
    return nums;
  });
  expect(tiles.length).toBeGreaterThanOrEqual(3);
});

test("a student with no pass sees the locked review — no answer key, nothing marked red", async ({ page }) => {
  test.skip(!sample, "no free sample with questions in this database");
  const crashes = watchForCrashes(page);
  await login(page);

  const attempt = await prisma.attempt.findFirstOrThrow({
    where: { studentId, testId: sample!.testId, status: "COMPLETED" },
    select: { id: true }, orderBy: { id: "desc" },
  });

  const payload = await page.evaluate(async (id) => {
    const r = await fetch(`/api/attempts/${id}/result`);
    return r.json();
  }, attempt.id);

  expect(payload.data.solutionsLocked).toBe(true);
  expect(payload.data.upsell).not.toBeNull();
  // The key never leaves the server, whatever the page does with it.
  for (const q of payload.data.questions) {
    expect(q.allOptions.every((o: { isCorrect: boolean }) => o.isCorrect === false)).toBe(true);
  }

  await page.goto(`/attempts/${attempt.id}/result`);
  await expectNoPageError(page, crashes);

  // Every option is flattened to `isCorrect: false`, so the old styling marked
  // the student's own answer wrong on every question. Their selection must
  // read neutrally instead.
  const redOptionRows = await page.evaluate(() =>
    [...document.querySelectorAll('[class*="destructive"]')]
      .filter((n) => /^[A-D]\b/.test(n.textContent?.trim() ?? "")).length,
  );
  expect(redOptionRows, "no option row may be styled as wrong when locked").toBe(0);
});

test("a pass holder reviewing the same free sample gets full solutions and no upsell", async ({ page }) => {
  test.skip(!sample, "no free sample with questions in this database");

  // The regression: a free sample resolves FREE_SAMPLE for everyone, so
  // deriving solutions from that reason alone charged a pass holder for
  // solutions already in their account.
  await grantPaidPass(studentId, sample!.boardId, sample!.classId, 100000);

  const crashes = watchForCrashes(page);
  await login(page);
  const attempt = await prisma.attempt.findFirstOrThrow({
    where: { studentId, testId: sample!.testId, status: "COMPLETED" },
    select: { id: true }, orderBy: { id: "desc" },
  });

  const payload = await page.evaluate(async (id) => {
    const r = await fetch(`/api/attempts/${id}/result`);
    return r.json();
  }, attempt.id);

  expect(payload.data.showSolutions).toBe(true);
  expect(payload.data.solutionsLocked).toBe(false);
  expect(payload.data.upsell).toBeNull();

  await page.goto(`/attempts/${attempt.id}/result`);
  await expectNoPageError(page, crashes);
  await expect(page.getByRole("button", { name: /hide solutions|show solutions/i })).toBeVisible();
  await expect(page.getByText(/included in the class pass/i)).toHaveCount(0);
});
