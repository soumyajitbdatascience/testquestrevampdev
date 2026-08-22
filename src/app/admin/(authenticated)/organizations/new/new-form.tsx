"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Plan { id: number; name: string; basePrice: number; durationDays: number }

function planLabel(p: Plan): string {
  if (p.basePrice === 0) return `${p.name} (free)`;
  const months = Math.round(p.durationDays / 30);
  const period = months >= 12 ? `${Math.round(months / 12)}y` : `${months}m`;
  return `${p.name} (₹${p.basePrice} / ${period})`;
}

const STAGES = ["PROSPECT", "DEMO", "PILOT", "ACTIVE"] as const;

export function NewOrgForm({ plans }: { plans: Plan[] }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [planId, setPlanId] = useState<number | null>(plans[0]?.id ?? null);
  const [seats, setSeats] = useState(50);
  const [stage, setStage] = useState<typeof STAGES[number]>("PROSPECT");
  const [notes, setNotes] = useState("");
  const [followup, setFollowup] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ orgId: number; welcomeUrl: string; emailDelivered: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError("Centre name is required."); return; }
    if (!ownerEmail.includes("@")) { setError("Owner email looks wrong."); return; }
    if (!planId) { setError("Pick a plan."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim() || null,
          ownerName: ownerName.trim(),
          ownerEmail: ownerEmail.trim().toLowerCase(),
          planId,
          seatsPurchased: seats,
          salesStage: stage,
          salesNotes: notes.trim() || undefined,
          nextFollowupAt: followup || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Couldn't create the centre."); return; }
      setCreated({
        orgId: data.data.orgId,
        welcomeUrl: data.data.welcomeUrl,
        emailDelivered: data.data.emailDelivered,
      });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally { setLoading(false); }
  }

  if (created) {
    return (
      <>
        <AdminPageHeader title="Centre created" subtitle={`Org #${created.orgId} is ready. The owner has been emailed a welcome link.`} />
        <div className="rounded-[18px] border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{created.emailDelivered ? "Welcome email sent." : "Email send returned no delivery."}</span>
          </div>
          <div className="space-y-1">
            <Label>Welcome link (for sharing manually if email bounces)</Label>
            <div className="flex items-center gap-2">
              <Input value={created.welcomeUrl} readOnly className="h-10 bg-surface-hi/30 font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(created.welcomeUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => router.push(`/admin/organizations/${created.orgId}`)}>
              View centre
            </Button>
            <Button variant="outline" onClick={() => router.push("/admin/organizations")}>
              Back to list
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to organizations
      </Link>

      <AdminPageHeader
        title="Onboard a centre"
        subtitle="Create the org, set the plan + CRM bookkeeping, and the owner gets a welcome email."
      />

      <form onSubmit={submit} className="rounded-[18px] border bg-surface p-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="o-name">Centre name</Label>
            <Input id="o-name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} placeholder="Acme Tutorials" className="h-10 bg-surface-hi/30" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="o-city">City</Label>
            <Input id="o-city" value={city} onChange={(e) => setCity(e.target.value)} disabled={loading} placeholder="Pune" className="h-10 bg-surface-hi/30" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="o-plan">Plan</Label>
            <select
              id="o-plan"
              value={planId ?? ""}
              onChange={(e) => setPlanId(Number(e.target.value) || null)}
              disabled={loading}
              className="w-full h-10 rounded-md border bg-surface-hi/30 px-3 text-sm"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{planLabel(p)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t pt-5 space-y-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Owner</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="o-owner-name">Owner name</Label>
              <Input id="o-owner-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} disabled={loading} placeholder="Rahul Iyer" className="h-10 bg-surface-hi/30" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="o-owner-email">Owner email</Label>
              <Input id="o-owner-email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} disabled={loading} placeholder="rahul@acmetutorials.in" className="h-10 bg-surface-hi/30" />
            </div>
          </div>
        </div>

        <div className="border-t pt-5 space-y-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">CRM</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="o-stage">Sales stage</Label>
              <select id="o-stage" value={stage} onChange={(e) => setStage(e.target.value as typeof STAGES[number])} disabled={loading} className="w-full h-10 rounded-md border bg-surface-hi/30 px-3 text-sm">
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="o-followup">Next follow-up</Label>
              <Input id="o-followup" type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} disabled={loading} className="h-10 bg-surface-hi/30" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="o-seats">Seats</Label>
              <Input id="o-seats" type="number" min={10} max={10000} value={seats} onChange={(e) => setSeats(Number(e.target.value) || 50)} disabled={loading} className="h-10 bg-surface-hi/30" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="o-notes">Sales notes</Label>
            <textarea
              id="o-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              placeholder="What we learned on the call, next steps, decision-makers, etc."
              className="w-full min-h-[96px] rounded-md border bg-surface-hi/30 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="h-11">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
          {loading ? "Creating…" : "Create centre & send welcome email"}
        </Button>
      </form>
    </>
  );
}
