import "dotenv/config";
import { resolveTestAccess } from "../../src/lib/access";
import { prisma } from "../../src/lib/db";

const SID = 999901; // synthetic student id — cleaned up below
(async () => {
  // clean any leftovers from prior failed runs
  await prisma.classAccess.deleteMany({ where: { studentId: SID } });
  await prisma.studentAccess.deleteMany({ where: { studentId: SID } });
  await prisma.chapterTest.deleteMany({ where: { chapter: undefined, testId: 92 } }).catch(() => {});
  await prisma.$executeRawUnsafe("DELETE ct FROM tq_chapter_tests ct JOIN tq_chapters c ON c.id = ct.chapterId WHERE c.name = '_tmp_check_chapter'");
  await prisma.$executeRawUnsafe("DELETE FROM tq_chapters WHERE name = '_tmp_check_chapter'");
  const t92 = { testId: 92, isFree: false, classId: 6 };
  const cbse = await prisma.board.findUniqueOrThrow({ where: { code: "CBSE" } });
  const plan = await prisma.b2cPlan.findFirstOrThrow({ where: { boardId: cbse.id } });

  // 1. Pass covering a DIFFERENT class -> still NONE
  const wrong = await prisma.classAccess.create({ data: { studentId: SID, boardId: cbse.id, classId: 999, planId: plan.id, orderId: 0, startsAt: new Date(), expiresAt: new Date(Date.now() + 86400e3) } });
  console.log("pass wrong class:", await resolveTestAccess(SID, t92));

  // 2. Pass covering class 6 (untagged test -> class match) -> CLASS_PASS
  const right = await prisma.classAccess.create({ data: { studentId: SID, boardId: cbse.id, classId: 6, planId: plan.id, orderId: 0, startsAt: new Date(), expiresAt: new Date(Date.now() + 86400e3) } });
  console.log("pass class 6 (untagged):", await resolveTestAccess(SID, t92));

  // 3. Expired pass -> NONE again
  await prisma.classAccess.update({ where: { id: right.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  console.log("pass expired:", await resolveTestAccess(SID, t92));

  // 4. Grandfathered tq_student_access -> GRANDFATHERED
  await prisma.studentAccess.create({ data: { studentId: SID, testId: 92, orderId: null, expiresAt: null } });
  console.log("grandfathered:", await resolveTestAccess(SID, t92));

  // 5. Tagged test in a scoped chapter + matching pass -> CLASS_PASS via tagging
  const chap = await prisma.chapter.create({ data: { subjectId: 275, boardId: cbse.id, classId: 6, name: "_tmp_check_chapter" } });
  await prisma.chapterTest.create({ data: { chapterId: chap.id, testId: 92 } });
  await prisma.studentAccess.deleteMany({ where: { studentId: SID } });
  await prisma.classAccess.update({ where: { id: right.id }, data: { expiresAt: new Date(Date.now() + 86400e3) } });
  console.log("tagged + matching pass:", await resolveTestAccess(SID, t92));

  // cleanup
  await prisma.chapterTest.deleteMany({ where: { chapterId: chap.id } });
  await prisma.chapter.delete({ where: { id: chap.id } });
  await prisma.classAccess.deleteMany({ where: { studentId: SID } });
  await prisma.studentAccess.deleteMany({ where: { studentId: SID } });
  console.log("cleaned up");
  process.exit(0);
})();
