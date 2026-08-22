/**
 * Shared lookup helpers for commerce endpoints.
 *
 * Commerce tables (`tq_orders`, `tq_student_access`, `tq_coupon_usages`) hold
 * `studentId` and `testId` columns that are soft references to legacy
 * `student` (vw_students) and the test union view (vw_tests). The hard FKs to
 * the empty `tq_students` / `tq_tests` tables were dropped — see
 * `prisma/migration/drop-bundle-test-fk.ts` and `drop-test-fks.ts`.
 *
 * Use these helpers when you need to enrich commerce rows with student / test
 * names, since Prisma `include: { student: ... }` no longer works.
 */
import { prisma } from "./db";

export interface TestMeta {
  id: number;
  name: string;
  price: number;
  isFree: boolean;
  isActive: boolean;
  classId: number | null;
  className: string | null;
  subjectId: number | null;
  subjectName: string | null;
}

export async function findTestById(testId: number): Promise<TestMeta | null> {
  const rows = await prisma.$queryRaw<Array<{
    id: number; name: string; price: unknown; isFree: number | boolean; isActive: number | boolean;
    classId: number | null; className: string | null;
    subjectId: number | null; subjectName: string | null;
  }>>`
    SELECT t.id, t.name, t.price, t.isFree, t.isActive,
           t.classId, c.name AS className,
           t.subjectId, s.name AS subjectName
    FROM vw_tests t
    LEFT JOIN vw_classes c ON c.id = t.classId
    LEFT JOIN vw_subjects s ON s.id = t.subjectId
    WHERE t.id = ${testId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    name: r.name,
    price: Number(r.price ?? 0),
    isFree: !!r.isFree,
    isActive: !!r.isActive,
    classId: r.classId !== null ? Number(r.classId) : null,
    className: r.className,
    subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
    subjectName: r.subjectName,
  };
}

export async function findTestsByIds(ids: number[]): Promise<Map<number, TestMeta>> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number; name: string; price: unknown; isFree: number | boolean; isActive: number | boolean;
    classId: number | null; className: string | null;
    subjectId: number | null; subjectName: string | null;
  }>>(
    `SELECT t.id, t.name, t.price, t.isFree, t.isActive,
            t.classId, c.name AS className,
            t.subjectId, s.name AS subjectName
     FROM vw_tests t
     LEFT JOIN vw_classes c ON c.id = t.classId
     LEFT JOIN vw_subjects s ON s.id = t.subjectId
     WHERE t.id IN (${placeholders})`,
    ...ids,
  );
  const map = new Map<number, TestMeta>();
  for (const r of rows) {
    map.set(Number(r.id), {
      id: Number(r.id),
      name: r.name,
      price: Number(r.price ?? 0),
      isFree: !!r.isFree,
      isActive: !!r.isActive,
      classId: r.classId !== null ? Number(r.classId) : null,
      className: r.className,
      subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
      subjectName: r.subjectName,
    });
  }
  return map;
}

export interface StudentMeta {
  id: number;
  name: string;
  email: string;
}

export async function findStudentsByIds(ids: number[]): Promise<Map<number, StudentMeta>> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number; name: string; email: string;
  }>>(
    `SELECT id, name, email FROM vw_students WHERE id IN (${placeholders})`,
    ...ids,
  );
  return new Map(rows.map((r) => [Number(r.id), { id: Number(r.id), name: r.name, email: r.email }]));
}
