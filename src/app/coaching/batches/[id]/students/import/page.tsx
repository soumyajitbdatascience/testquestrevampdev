/**
 * /coaching/batches/[id]/students/import — Task 5.3.3.
 *
 * Server shell: validates auth + batch scope, then hands off to <ImportClient />
 * which owns the file picker / upload / result rendering.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function ImportStudentsPage({ params }: Params) {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole !== "OWNER" && session.orgRole !== "ADMIN") {
    redirect("/coaching/dashboard");
  }

  const { id } = await params;
  const batchId = Number(id);
  if (!Number.isFinite(batchId)) notFound();

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true, orgId: true },
  });
  if (!batch || batch.orgId !== session.orgId) notFound();

  return (
    <>
      <CoachingHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <Link
          href={`/coaching/batches/${batch.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {batch.name}
        </Link>

        <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">
          Import students
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a CSV with up to 200 students. We&rsquo;ll enroll them into{" "}
          <span className="font-medium text-foreground">{batch.name}</span>.
        </p>

        <ImportClient batchId={batch.id} />
      </main>
    </>
  );
}
