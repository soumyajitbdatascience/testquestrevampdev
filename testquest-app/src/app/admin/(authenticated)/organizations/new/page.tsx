/**
 * /admin/organizations/new — sales-led centre creation form.
 *
 * Server shell loads active coaching-tier plans so the picker has options.
 */
import { prisma } from "@/lib/db";
import { NewOrgForm } from "./new-form";

export const dynamic = "force-dynamic";

export default async function NewOrgPage() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true, targetAudience: "COACHING_CENTRE" },
    orderBy: { basePrice: "asc" },
    select: { id: true, name: true, basePrice: true, durationDays: true },
  });

  return (
    <div className="p-8 max-w-[800px] mx-auto">
      <NewOrgForm
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          basePrice: Number(p.basePrice),
          durationDays: p.durationDays,
        }))}
      />
    </div>
  );
}
