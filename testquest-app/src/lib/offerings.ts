import { prisma } from "@/lib/db";

/**
 * Offering resolution helpers.
 *
 * In the decoupled model an Offering (Board + Class + Subject) is the anchor
 * every piece of content hangs off. Screens and APIs that still speak in the
 * old board/class/subject triple resolve it to an offering id here.
 */

/** Returns the offering id for a board+class+subject triple, or null. */
export async function findOfferingId(
  boardId: number,
  classId: number,
  subjectId: number,
): Promise<number | null> {
  const offering = await prisma.offering.findUnique({
    where: { boardId_classId_subjectId: { boardId, classId, subjectId } },
    select: { id: true },
  });
  return offering?.id ?? null;
}

/**
 * Same, but creates the shelf if it doesn't exist yet. Use only on admin write
 * paths where the intent is "put content here" — reads should use
 * `findOfferingId` and treat null as "nothing configured yet".
 */
export async function ensureOfferingId(
  boardId: number,
  classId: number,
  subjectId: number,
): Promise<number> {
  const offering = await prisma.offering.upsert({
    where: { boardId_classId_subjectId: { boardId, classId, subjectId } },
    create: { boardId, classId, subjectId },
    update: {},
    select: { id: true },
  });
  return offering.id;
}

export type OfferingLabel = {
  id: number;
  boardId: number;
  classId: number;
  subjectId: number;
  boardName: string;
  boardCode: string;
  className: string;
  subjectName: string;
  /** "CBSE ▸ Class 10 ▸ Mathematics" — the workspace header string. */
  label: string;
};

/** Loads an offering with its master names resolved, for headers and lists. */
export async function getOfferingLabel(offeringId: number): Promise<OfferingLabel | null> {
  const o = await prisma.offering.findUnique({
    where: { id: offeringId },
    include: { board: true, class: true, subject: true },
  });
  if (!o) return null;
  return {
    id: o.id,
    boardId: o.boardId,
    classId: o.classId,
    subjectId: o.subjectId,
    boardName: o.board.name,
    boardCode: o.board.code,
    className: o.class.name,
    subjectName: o.subject.name,
    label: `${o.board.code} ▸ ${o.class.name} ▸ ${o.subject.name}`,
  };
}
