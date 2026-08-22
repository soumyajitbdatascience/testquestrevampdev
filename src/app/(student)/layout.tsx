import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listStudentContextCards, resolveActiveContext } from "@/lib/student-context";
import { StudentShell, type ShellContext } from "@/components/student/student-shell";

/**
 * The single student shell + the onboarding gate.
 *
 * Every signed-in student page lives under this group, so the header is
 * rendered in exactly one place and cannot differ between routes. The two
 * deliberate exceptions are the attempt player (deliberately chrome-free while
 * a paper is running) and onboarding itself (which would otherwise gate
 * itself into a loop).
 *
 * The gate is here, on the server, rather than in a page's `useEffect`. It
 * used to live only inside Home, which is why a student entering through any
 * other route was re-asked to onboard every login even though their contexts
 * had persisted all along: nothing on that path ever read them.
 *
 * `tq_student_contexts` is the only thing consulted. One row is enough,
 * forever — a student who has onboarded never sees onboarding again, whichever
 * route they arrive on.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/login");

  const contexts = await listStudentContextCards(session.id);
  if (contexts.length === 0) redirect("/onboarding");

  const active = await resolveActiveContext(session.id, contexts);

  const student = await prisma.student.findUnique({
    where: { id: session.id },
    select: { name: true },
  });

  // boardId/classId travel with each row so the add-class sheet can mark the
  // classes already held without a second round trip.
  const shellContexts: ShellContext[] = contexts.map((c) => ({
    id: c.id,
    boardId: c.boardId,
    boardName: c.boardName,
    boardCode: c.boardCode,
    classId: c.classId,
    className: c.className,
    subscribed: c.subscribed,
    passExpiresAt: c.passExpiresAt ? c.passExpiresAt.toISOString() : null,
  }));

  return (
    <StudentShell
      contexts={shellContexts}
      activeContextId={active?.id ?? null}
      userName={student?.name ?? null}
    >
      {children}
    </StudentShell>
  );
}
