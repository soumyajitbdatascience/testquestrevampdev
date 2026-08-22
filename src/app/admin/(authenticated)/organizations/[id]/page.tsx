/**
 * /admin/organizations/[id] — centre detail for Testquest staff.
 *
 * Phase 2 / Task 2.5. Server loads the detail (members, batches, billing,
 * sales fields) then hands off to the client for tab navigation + CRM edits
 * + "Resend invite" action.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOrganizationDetail } from "@/lib/services/organization-admin.service";
import { prisma } from "@/lib/db";
import { OrgDetailClient } from "./detail-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function OrgDetailPage({ params }: Params) {
  const { id } = await params;
  const orgId = Number(id);
  if (!Number.isFinite(orgId)) notFound();
  const detail = await getOrganizationDetail(orgId);
  if (!detail) notFound();

  // Candidate parent orgs (other COACHING_CENTREs) for the parent-link picker.
  const parentCandidates = await prisma.organization.findMany({
    where: { type: "COACHING_CENTRE", id: { not: orgId } },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });

  // Date fields → ISO for the client boundary.
  const dto = {
    ...detail,
    createdAt: detail.createdAt.toISOString(),
    members: detail.members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() })),
    batches: detail.batches.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
    subscription: detail.subscription ? {
      ...detail.subscription,
      expiresAt: detail.subscription.expiresAt?.toISOString() ?? null,
      createdAt: detail.subscription.createdAt.toISOString(),
    } : null,
  };

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to organizations
      </Link>

      <OrgDetailClient initial={dto} parentCandidates={parentCandidates} />
    </div>
  );
}
