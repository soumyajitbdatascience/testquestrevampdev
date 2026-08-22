"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Copy, KeyRound, Loader2, Save, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Member {
  membershipId: number;
  userId: number;
  role: string;
  name: string | null;
  email: string | null;
  joinedAt: string;
  isActive: boolean;
}
interface Batch {
  id: number;
  name: string;
  className: string | null;
  studentCount: number;
  createdAt: string;
  isActive: boolean;
}
interface Subscription {
  status: string;
  planName: string;
  seatsPurchased: number;
  expiresAt: string | null;
  createdAt: string;
}
interface Sales {
  salesStage?: string;
  salesNotes?: string;
  nextFollowupAt?: string;
  onboardingPath?: string;
}
interface Detail {
  id: number;
  name: string;
  type: string;
  city: string | null;
  logoUrl: string | null;
  parentOrgId: number | null;
  ownerUserId: number;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerHasPassword: boolean;
  createdAt: string;
  members: Member[];
  batches: Batch[];
  subscription: Subscription | null;
  stats: { members: number; batches: number; students: number; assignmentsThisWeek: number };
  sales: Sales;
}

const STAGES = ["PROSPECT", "DEMO", "PILOT", "ACTIVE", "CHURNED"] as const;

function stageBadge(stage?: string) {
  switch (stage) {
    case "ACTIVE":   return "bg-green-500/15 text-green-400";
    case "PILOT":    return "bg-yellow-500/15 text-yellow-500";
    case "DEMO":     return "bg-blue-500/15 text-blue-400";
    case "CHURNED":  return "bg-red-500/15 text-red-400";
    default:         return "bg-surface-hi text-muted-foreground";
  }
}
function statusBadge(status?: string) {
  switch (status) {
    case "ACTIVE":  return "bg-green-500/15 text-green-400";
    case "TRIAL":   return "bg-blue-500/15 text-blue-400";
    case "GRACE":   return "bg-yellow-500/15 text-yellow-500";
    case "EXPIRED": return "bg-red-500/15 text-red-400";
    default:        return "bg-surface-hi text-muted-foreground";
  }
}
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function OrgDetailClient({
  initial,
  parentCandidates = [],
}: {
  initial: Detail;
  parentCandidates?: Array<{ id: number; name: string; city: string | null }>;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  // Parent-org link state (Task 4.4).
  const [parentSel, setParentSel] = useState<string>(
    detail.parentOrgId != null ? String(detail.parentOrgId) : "",
  );
  const [savingParent, setSavingParent] = useState(false);
  const [parentSaved, setParentSaved] = useState<string | null>(null);

  async function saveParent() {
    setSavingParent(true);
    setError(null);
    setParentSaved(null);
    try {
      const res = await fetch(`/api/admin/organizations/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentOrgId: parentSel ? Number(parentSel) : null }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Couldn't save.");
        return;
      }
      setDetail((d) => ({ ...d, parentOrgId: data.data.parentOrgId ?? null }));
      setParentSaved("Saved.");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSavingParent(false);
    }
  }

  // CRM edit state
  const [stage, setStage] = useState(detail.sales.salesStage ?? "PROSPECT");
  const [notes, setNotes] = useState(detail.sales.salesNotes ?? "");
  const [followup, setFollowup] = useState(detail.sales.nextFollowupAt ?? "");
  const [savingCrm, setSavingCrm] = useState(false);
  const [crmSaved, setCrmSaved] = useState<string | null>(null);

  async function saveCrm() {
    setSavingCrm(true); setError(null); setCrmSaved(null);
    try {
      const res = await fetch(`/api/admin/organizations/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesStage: stage,
          salesNotes: notes.trim() || null,
          nextFollowupAt: followup || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Couldn't save."); return; }
      setDetail((d) => ({ ...d, sales: data.data.sales }));
      setCrmSaved("Saved.");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally { setSavingCrm(false); }
  }

  // Resend invite state
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<{ url: string; emailDelivered: boolean } | null>(null);

  async function resendInvite() {
    setResending(true); setError(null); setResendResult(null);
    try {
      const res = await fetch(`/api/admin/organizations/${detail.id}/resend-invite`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Couldn't resend."); return; }
      setResendResult({ url: data.data.url, emailDelivered: data.data.emailDelivered });
    } catch {
      setError("Couldn't reach the server.");
    } finally { setResending(false); }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-dim text-primary shrink-0">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{detail.type}</p>
            <h1 className="mt-0.5 font-display text-3xl md:text-4xl">{detail.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.city ?? "—"} · created {formatDate(detail.createdAt)}
              {detail.sales.onboardingPath && <> · {detail.sales.onboardingPath === "SALES_LED" ? "Sales-led" : "Self-serve"}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {detail.sales.salesStage && (
            <Badge className={cn("text-[10px] uppercase tracking-widest", stageBadge(detail.sales.salesStage))}>
              {detail.sales.salesStage}
            </Badge>
          )}
          {detail.subscription && (
            <Badge className={cn("text-[10px] uppercase tracking-widest", statusBadge(detail.subscription.status))}>
              {detail.subscription.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Owner-not-set warning + Resend */}
      {!detail.ownerHasPassword && (
        <div className="mb-6 rounded-[14px] border border-yellow-500/40 bg-yellow-500/10 p-4 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Owner hasn&apos;t set their password yet.</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send {detail.ownerName ?? "the owner"} another welcome link if needed.
              </p>
            </div>
          </div>
          <Button onClick={resendInvite} disabled={resending} variant="outline">
            {resending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            {resending ? "Sending…" : "Resend welcome"}
          </Button>
        </div>
      )}

      {resendResult && (
        <div className="mb-6 rounded-[14px] border border-primary/40 bg-primary-dim/30 p-4 space-y-2">
          <p className="text-sm">{resendResult.emailDelivered ? "Welcome email sent." : "Email returned no delivery."}</p>
          <div className="flex items-center gap-2">
            <Input value={resendResult.url} readOnly className="h-9 bg-surface-hi/30 font-mono text-xs" />
            <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(resendResult.url)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-[12px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Members" value={detail.stats.members} />
        <Stat label="Batches" value={detail.stats.batches} />
        <Stat label="Students" value={detail.stats.students} />
        <Stat label="Assigned this week" value={detail.stats.assignmentsThisWeek} />
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="sales">Sales notes</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          {detail.members.length === 0 ? (
            <Soft>No members yet.</Soft>
          ) : (
            <div className="rounded-[14px] border bg-surface divide-y">
              {detail.members.map((m) => (
                <div key={m.membershipId} className="flex items-center gap-3 px-4 py-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-hi text-xs font-medium">
                    {(m.name || m.email || "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.email ?? "—"}</p>
                  </div>
                  <Badge className="text-[10px] uppercase tracking-widest">{m.role}</Badge>
                  {!m.isActive && <span className="text-[10px] text-destructive">revoked</span>}
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">joined {formatDate(m.joinedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="batches" className="mt-6">
          {detail.batches.length === 0 ? (
            <Soft>No batches yet.</Soft>
          ) : (
            <div className="rounded-[14px] border bg-surface divide-y">
              {detail.batches.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.name}</p>
                    <p className="text-[11px] text-muted-foreground">{b.className ?? "—"} · {b.studentCount} students</p>
                  </div>
                  {!b.isActive && <span className="text-[10px] text-destructive">archived</span>}
                  <span className="text-[11px] text-muted-foreground">created {formatDate(b.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          {detail.subscription ? (
            <div className="rounded-[14px] border bg-surface p-5 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{detail.subscription.planName}</span>
                <Badge className={cn("text-[10px] uppercase tracking-widest", statusBadge(detail.subscription.status))}>
                  {detail.subscription.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Seats: {detail.subscription.seatsPurchased}</p>
                <p>Started: {formatDate(detail.subscription.createdAt)}</p>
                <p>Expires: {formatDate(detail.subscription.expiresAt)}</p>
              </div>
            </div>
          ) : (
            <Soft>No active subscription.</Soft>
          )}
        </TabsContent>

        <TabsContent value="sales" className="mt-6 space-y-6">
          <div className="rounded-[18px] border bg-surface p-5 space-y-4 max-w-[640px]">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Parent organisation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Link this centre under a parent org to enable branch switching for that parent&apos;s OWNER/ADMIN.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="parent-org">Parent org</Label>
              <select
                id="parent-org"
                value={parentSel}
                onChange={(e) => setParentSel(e.target.value)}
                disabled={savingParent}
                className="w-full h-10 rounded-md border bg-surface-hi/30 px-3 text-sm"
              >
                <option value="">— None (top-level centre) —</option>
                {parentCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.city ? ` · ${p.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={saveParent} disabled={savingParent}>
                {savingParent ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                {savingParent ? "Saving…" : "Save parent"}
              </Button>
              {parentSaved && !error && <span className="text-xs text-primary">{parentSaved}</span>}
            </div>
          </div>

          <div className="rounded-[18px] border bg-surface p-5 space-y-4 max-w-[640px]">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="crm-stage">Sales stage</Label>
                <select id="crm-stage" value={stage} onChange={(e) => setStage(e.target.value)} disabled={savingCrm} className="w-full h-10 rounded-md border bg-surface-hi/30 px-3 text-sm">
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="crm-followup">Next follow-up</Label>
                <Input id="crm-followup" type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} disabled={savingCrm} className="h-10 bg-surface-hi/30" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="crm-notes">Notes</Label>
              <textarea
                id="crm-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={savingCrm}
                className="w-full min-h-[120px] rounded-md border bg-surface-hi/30 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={saveCrm} disabled={savingCrm}>
                {savingCrm ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                {savingCrm ? "Saving…" : "Save"}
              </Button>
              {crmSaved && !error && <span className="text-xs text-primary">{crmSaved}</span>}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border bg-surface p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl">{value}</p>
    </div>
  );
}

function Soft({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border bg-surface px-5 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
