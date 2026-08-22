import { test, expect } from "@playwright/test";
import { shot } from "../helpers/shot";
import { prisma, tag } from "../helpers/db";

/**
 * The single-question editor — the gap the content team actually hit: they
 * could bulk-import but could not add one question or fix a typo from the UI.
 *
 * Both cases drive the real dialog rather than the routes directly: the routes
 * already had tests, and what was missing was the UI that reaches them.
 *
 * Everything created is named with the run's E2E tag, which is what the shared
 * teardown matches — no fixture outlives the run.
 */

/** An offering that has at least one chapter to tag a question to. */
async function pickOffering() {
  return prisma.offering.findFirst({
    where: { isActive: true, chapters: { some: { isActive: true } } },
    select: {
      id: true,
      subject: { select: { name: true } },
      chapters: { where: { isActive: true }, select: { id: true, name: true }, take: 1 },
    },
    orderBy: { id: "asc" },
  });
}

test.describe.configure({ mode: "serial" });

let offeringId: number;
let addedText: string;

test("Q1 add a single-answer MCQ from the Questions tab", async ({ page }) => {
  const offering = await pickOffering();
  test.skip(!offering, "no offering with a chapter to attach a question to");
  offeringId = offering!.id;
  addedText = `${tag("Q")} What is the SI unit of force?`;

  await page.goto(`/admin/offerings/${offeringId}?tab=questions`);
  await page.getByRole("button", { name: /add question/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Add question" })).toBeVisible();

  await dialog.getByLabel("Chapter").selectOption(String(offering!.chapters[0].id));
  await dialog.getByLabel("Type").selectOption("SINGLE_MCQ");
  await dialog.getByLabel("Difficulty").selectOption("EASY");
  await dialog.getByPlaceholder(/Question text/).fill(addedText);

  await dialog.getByPlaceholder("Option A").fill("Newton");
  await dialog.getByPlaceholder("Option B").fill("Joule");
  await dialog.getByPlaceholder("Option C").fill("Watt");
  await dialog.getByPlaceholder("Option D").fill("Pascal");

  // Validation must bite before the network: two correct on a single-answer
  // question is exactly what the importer rejects.
  await dialog.getByLabel("Option A is correct").check();
  await expect(dialog.getByLabel("Option A is correct")).toBeChecked();
  // The radio group enforces "exactly one" by construction — checking B must
  // release A rather than leaving two set.
  await dialog.getByLabel("Option B is correct").check();
  await expect(dialog.getByLabel("Option A is correct")).not.toBeChecked();
  await dialog.getByLabel("Option A is correct").check();

  await shot(page, "q-add-dialog");
  await dialog.getByRole("button", { name: "Add question" }).click();

  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(/Added question #\d+/)).toBeVisible({ timeout: 30_000 });

  // It is in the bank, with the shape that was asked for.
  const created = await prisma.question.findFirst({
    where: { text: addedText },
    select: { id: true, type: true, difficulty: true, chapterId: true, options: { select: { label: true, text: true, isCorrect: true } } },
  });
  expect(created, "the question should exist in the bank").not.toBeNull();
  expect(created!.type).toBe("SINGLE_MCQ");
  expect(created!.difficulty).toBe("EASY");
  expect(created!.chapterId).toBe(offering!.chapters[0].id);
  expect(created!.options).toHaveLength(4);
  expect(created!.options.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(["A"]);

  await shot(page, "q-add-listed");
});

test("Q2 edit that question's text and correct answer", async ({ page }) => {
  test.skip(!offeringId, "add case did not run");
  const before = await prisma.question.findFirstOrThrow({
    where: { text: addedText }, select: { id: true },
  });
  const editedText = `${addedText} (edited)`;

  await page.goto(`/admin/offerings/${offeringId}?tab=questions`);
  // Narrow to the question just added — the bank runs to thousands of rows.
  await page.getByPlaceholder("Search question text").fill(tag("Q"));
  const row = page.locator("tr", { hasText: tag("Q") }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });

  await row.getByRole("button", { name: `Edit question ${before.id}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Edit question #${before.id}` })).toBeVisible();

  // Pre-filled from the stored question, not blank.
  await expect(dialog.getByPlaceholder(/Question text/)).toHaveValue(addedText);
  await expect(dialog.getByLabel("Option A is correct")).toBeChecked();

  await dialog.getByPlaceholder(/Question text/).fill(editedText);
  await dialog.getByLabel("Option C is correct").check();
  await shot(page, "q-edit-dialog");
  await dialog.getByRole("button", { name: /save changes/i }).click();

  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(`Saved question #${before.id}`)).toBeVisible({ timeout: 30_000 });

  // Both the text and the moved correct answer persisted, and the option set
  // was replaced wholesale rather than accumulating.
  const after = await prisma.question.findUniqueOrThrow({
    where: { id: before.id },
    select: { text: true, options: { select: { label: true, isCorrect: true } } },
  });
  expect(after.text).toBe(editedText);
  expect(after.options).toHaveLength(4);
  expect(after.options.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(["C"]);

  await shot(page, "q-edit-saved");
});
