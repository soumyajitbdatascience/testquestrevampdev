"use client";

/**
 * /admin/organizations — list of coaching centres for Testquest staff.
 *
 * Phase 2 / Task 2.5. Filters by sales stage / status / onboarding path /
 * free-text. CTA: "Onboard centre" → /admin/organizations/new.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, Plus, Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Row {
  id: number;
  name: string;
  type: string;
  city: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
  batchCount: number;
  studentCount: number;
  subscription: {
    status: string | null;
    planName: string | null;
    expiresAt: string | null;
  } | null;
  salesStage: string | null;
  nextFollowupAt: string | null;
  onboardingPath: string | null;
  createdAt: string;
}

const STAGE_OPTIONS = ["", "PROSPECT", "DEMO", "PILOT", "ACTIVE", "CHURNED"] as const;
const STATUS_OPTIONS = ["", "TRIAL", "ACTIVE", "GRACE", "EXPIRED", "CANCELED"] as const;
const PATH_OPTIONS = ["", "SELF_SERVE", "SALES_LED"] as const;

function stageBadge(stage: string | null) {
  switch (stage) {
    case "PROSPECT": return "bg-gray-500/15 text-gray-300";
    case "DEMO":     return "bg-blue-500/15 text-blue-400";
    case "PILOT":    return "bg-yellow-500/15 text-yellow-500";
    case "ACTIVE":   return "bg-green-500/15 text-green-400";
    case "CHURNED":  return "bg-red-500/15 text-red-400";
    default:         return "bg-surface-hi text-muted-foreground";
  }
}
function statusBadge(status: string | null) {
  switch (status) {
    case "ACTIVE":  return "bg-green-500/15 text-green-400";
    case "TRIAL":   return "bg-blue-500/15 text-blue-400";
    case "GRACE":   return "bg-yellow-500/15 text-yellow-500";
    case "EXPIRED": return "bg-red-500/15 text-red-400";
    default:        return "bg-surface-hi text-muted-foreground";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminOrganizationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [stage, setStage] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [path, setPath] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const reload = useCallback(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (stage) params.set("salesStage", stage);
    if (status) params.set("status", status);
    if (path) params.set("onboardingPath", path);
    fetch(`/api/admin/organizations?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error || "Couldn't load."); return; }
        setRows(d.data.rows);
        setTotal(d.data.total);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [debouncedQ, stage, status, path]);

  useEffect(() => reload(), [reload]);

  return (
    <div className="p-8 max-w-[1280px] mx-auto">
      <AdminPageHeader
        title="Organizations"
        subtitle="Coaching centres on Testquest — manage sales-led onboarding and CRM bookkeeping."
        action={
          <Link
            href="/admin/organizations/new"
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold shadow-gold transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            Onboard centre
          </Link>
        }
      />

      {/* Filters */}
      <div className="rounded-[14px] border bg-surface p-4 mb-6">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 pl-9 bg-surface-hi/30"
            />
          </div>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="h-10 rounded-md border bg-surface-hi/30 px-3 text-sm">
            {STAGE_OPTIONS.map((s) => (
              <option key={s || "all"} value={s}>{s ? `Stage: ${s}` : "All stages"}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border bg-surface-hi/30 px-3 text-sm">
            {STATUS_OPTIONS.map((s) => (
              <option key={s || "all"} value={s}>{s ? `Status: ${s}` : "All statuses"}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PATH_OPTIONS.map((p) => (
            <button
              type="button"
              key={p || "all"}
              onClick={() => setPath(p)}
              className={cn(
                "text-xs rounded-full border px-3 py-1 transition-colors",
                path === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-hi/30 text-foreground/90 border-border hover:border-primary/40",
              )}
            >
              {p === "" ? "All paths" : p === "SALES_LED" ? "Sales-led" : "Self-serve"}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-[14px] border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={reload} className="text-xs underline hover:no-underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="rounded-[14px] border bg-surface divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[22px] border bg-surface px-8 py-12 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-dim text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <h3 className="mt-5 font-display text-2xl">No coaching centres yet.</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Self-serve sign-ups land here automatically. Onboard a centre yourself to get started.
          </p>
          <Link
            href="/admin/organizations/new"
            className="mt-6 inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold shadow-gold"
          >
            Onboard centre
          </Link>
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground mb-2">{total.toLocaleString()} {total === 1 ? "centre" : "centres"}</div>
          <div className="rounded-[14px] border bg-surface divide-y">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/admin/organizations/${r.id}`}
                className="block px-4 py-3 hover:bg-white/2 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-hi text-xs font-medium text-foreground/90 shrink-0">
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.city ?? "—"} · {r.ownerName ?? "—"} · {r.ownerEmail ?? "—"}
                    </p>
                  </div>
                  <div className="hidden md:flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{r.memberCount} {r.memberCount === 1 ? "member" : "members"}</span>
                    <span>{r.batchCount} {r.batchCount === 1 ? "batch" : "batches"}</span>
                    <span>{r.studentCount} students</span>
                  </div>
                  <Badge className={cn("text-[10px] uppercase tracking-widest", stageBadge(r.salesStage))}>
                    {r.salesStage ?? "—"}
                  </Badge>
                  <Badge className={cn("text-[10px] uppercase tracking-widest", statusBadge(r.subscription?.status ?? null))}>
                    {r.subscription?.status ?? "—"}
                  </Badge>
                  {r.nextFollowupAt && (
                    <span className="hidden lg:inline text-[11px] text-muted-foreground">
                      Follow-up {formatDate(r.nextFollowupAt)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
