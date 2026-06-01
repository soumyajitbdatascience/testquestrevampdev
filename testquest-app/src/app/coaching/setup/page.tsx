/**
 * /coaching/setup — 5-step setup wizard host.
 *
 * Server component bootstraps the initial state from the session + org row +
 * Organization.brandingJson.setupProgress, then delegates rendering to the
 * client-side WizardClient which owns the state machine.
 *
 * If setup is already complete (or no setupProgress at all), we still let the
 * user enter the wizard — they may want to re-edit branding. The dashboard
 * decides whether to *force* the wizard via its own redirect guard.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readSetupProgress } from "@/lib/services/batch.service";
import { WizardClient, type WizardBootstrap } from "./wizard-client";

export const dynamic = "force-dynamic";

export default async function CoachingSetupPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");

  const [org, classes] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.orgId },
      select: { id: true, name: true, city: true, logoUrl: true, brandingJson: true },
    }),
    // Class catalogue for step 2 + 3 dropdown. Light query.
    prisma.$queryRaw<Array<{ id: number; name: string }>>`
      SELECT id, name FROM vw_classes WHERE isActive = 1 ORDER BY name LIMIT 200
    `,
  ]);
  if (!org) redirect("/coaching/login");

  const progress = await readSetupProgress(org.id);
  const branding = (org.brandingJson ?? {}) as { primaryColor?: string };

  const bootstrap: WizardBootstrap = {
    centreName: org.name,
    orgId: org.id,
    progress,
    initial: {
      branding: {
        displayName: progress.draft?.branding?.displayName ?? org.name,
        city: progress.draft?.branding?.city ?? org.city ?? "",
        logoUrl: progress.draft?.branding?.logoUrl ?? org.logoUrl ?? null,
        primaryColor: progress.draft?.branding?.primaryColor ?? branding.primaryColor ?? "oklch(0.78 0.17 65)",
      },
      classes: {
        boards: progress.draft?.classes?.boards ?? [],
        classIds: progress.draft?.classes?.classIds ?? [],
      },
      batch: {
        name: progress.draft?.batch?.name ?? "",
        classId: progress.draft?.batch?.classId ?? null,
        board: progress.draft?.batch?.board ?? "",
        subjects: progress.draft?.batch?.subjects ?? [],
        id: progress.draft?.batch?.id ?? null,
      },
    },
    classCatalogue: classes.map((c) => ({ id: Number(c.id), name: c.name })),
  };

  return <WizardClient bootstrap={bootstrap} />;
}
