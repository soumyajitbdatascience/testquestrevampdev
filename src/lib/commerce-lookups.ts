/**
 * Lookup helpers for commerce endpoints, against the decoupled schema.
 *
 * Replaces `legacy-lookups.ts`, which enriched commerce rows from the legacy
 * `vw_students` / `vw_tests` views. Those views do not exist here — and because
 * the old helpers returned an empty map for an empty id list, the endpoints
 * using them looked healthy only while the commerce tables were empty. They
 * would have failed on the first real order.
 *
 * `tq_orders.studentId` is a real FK to `tq_students` now, so these are plain
 * Prisma reads.
 */
import { prisma } from "./db";

export interface StudentMeta {
  id: number;
  name: string;
  email: string;
}

export async function findStudentsByIds(ids: number[]): Promise<Map<number, StudentMeta>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

export interface TestMeta {
  id: number;
  name: string;
  price: number;
  isFree: boolean;
  isActive: boolean;
  offeringId: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  boardCode: string;
}

const TEST_INCLUDE = {
  offering: {
    select: {
      id: true,
      classId: true,
      subjectId: true,
      board: { select: { code: true } },
      class: { select: { name: true } },
      subject: { select: { name: true } },
    },
  },
} as const;

type TestRow = {
  id: number; name: string; price: unknown; isFree: boolean; isActive: boolean;
  offering: {
    id: number; classId: number; subjectId: number;
    board: { code: string }; class: { name: string }; subject: { name: string };
  };
};

function toMeta(t: TestRow): TestMeta {
  return {
    id: t.id,
    name: t.name,
    price: Number(t.price ?? 0),
    isFree: t.isFree,
    isActive: t.isActive,
    offeringId: t.offering.id,
    classId: t.offering.classId,
    className: t.offering.class.name,
    subjectId: t.offering.subjectId,
    subjectName: t.offering.subject.name,
    boardCode: t.offering.board.code,
  };
}

export async function findTestById(testId: number): Promise<TestMeta | null> {
  const t = await prisma.test.findUnique({ where: { id: testId }, include: TEST_INCLUDE });
  return t ? toMeta(t as TestRow) : null;
}

export async function findTestsByIds(ids: number[]): Promise<Map<number, TestMeta>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.test.findMany({ where: { id: { in: ids } }, include: TEST_INCLUDE });
  return new Map(rows.map((t) => [t.id, toMeta(t as TestRow)]));
}
