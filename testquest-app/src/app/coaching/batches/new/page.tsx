/**
 * /coaching/batches/new — create a new batch (owners only).
 *
 * Minimal companion to Task 1.7. The setup wizard creates the FIRST batch;
 * this page covers "add another batch" from the dashboard CTA. Same fields
 * as the wizard's step-batch — name, class, board, subjects.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NewBatchClient } from "./new-batch-client";

export const dynamic = "force-dynamic";

export default async function NewBatchPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole !== "OWNER" && session.orgRole !== "ADMIN") redirect("/coaching/dashboard");

  const classes = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
    SELECT id, name FROM vw_classes WHERE isActive = 1 ORDER BY name LIMIT 200
  `;

  return <NewBatchClient classChoices={classes.map((c) => ({ id: Number(c.id), name: c.name }))} />;
}
