"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NeedsAttentionTray } from "@/components/admin/needs-attention-tray";
import {
  Loader2, Check, ArrowRight, BookOpen, HelpCircle, ClipboardList, Gift, BadgeIndianRupee,
} from "lucide-react";

/**
 * Launch readiness — the admin home.
 *
 * One row per offering, five gates each, and every unmet gate is a one-click
 * link into the exact tab that fixes it. The point is that opening the admin
 * should answer "what do I do next?" without hunting.
 */
interface Check { done: boolean; count: number; tab: string | null; href: string }
interface ReadinessRow {
  id: number;
  label: string;
  board: { id: number; name: string; code: string };
  class: { id: number; name: string };
  subject: { id: number; name: string };
  checks: { chapters: Check; questions: Check; tests: Check; freeSample: Check; plans: Check };
  done: number;
  total: number;
  status: "READY" | "IN_PROGRESS" | "NOT_STARTED";
  planDurations: number[];
  defects: { unrenderableMath: number; deadImages: number; mojibake: number } | null;
}

export interface TrayData {
  noFreeSample: Array<{ offeringId: number; label: string }>;
  noTests: Array<{ offeringId: number; label: string }>;
  noChapters: Array<{ offeringId: number; label: string }>;
  emptyTests: Array<{ testId: number; name: string; offeringId: number; label: string }>;
  untaggedQuestions: Array<{ subjectId: number; subjectName: string; count: number }>;
  contentDefects: Array<{ offeringId: number; label: string; unrenderableMath: number; deadImages: number; mojibake: number }>;
  missingPlans: Array<{ boardId: number; classId: number; label: string; durations: number[] }>;
}

interface Payload {
  summary: { total: number; ready: number; inProgress: number; notStarted: number };
  offerings: ReadinessRow[];
  tray: TrayData;
}

const CHECK_META = [
  { key: "chapters" as const,   label: "Chapters",    icon: BookOpen },
  { key: "questions" as const,  label: "Questions",   icon: HelpCircle },
  { key: "tests" as const,      label: "Tests",       icon: ClipboardList },
  { key: "freeSample" as const, label: "Free sample", icon: Gift },
  { key: "plans" as const,      label: "Plan priced", icon: BadgeIndianRupee },
];

type Filter = "ALL" | "READY" | "IN_PROGRESS" | "NOT_STARTED";

export default function AdminLaunchReadinessPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      // `no-store`: coming back from the pricing grid must recompute, never
      // replay the counts from before the prices were saved.
      const res = await fetch("/api/admin/launch-readiness", { signal, cache: "no-store" });
      const d = await res.json();
      if (signal?.aborted) return;
      if (d.ok) setData(d.data);
      setLoading(false);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return (
      <div className="p-6 lg:p-10">
        <div className="rounded-2xl border bg-card p-16 text-center text-muted-foreground">
          Could not load launch readiness.
        </div>
      </div>
    );
  }

  const { summary, offerings, tray } = data;
  const rows = filter === "ALL" ? offerings : offerings.filter((r) => r.status === filter);
  const pct = summary.total > 0 ? Math.round((summary.ready / summary.total) * 100) : 0;

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Launch readiness"
        subtitle={`${summary.ready} of ${summary.total} offerings ready to sell`}
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/offerings">
              All offerings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {/* Roll-up */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <button
          onClick={() => setFilter("ALL")}
          className={cn(
            "rounded-xl border bg-card p-4 text-left shadow-soft transition-colors",
            filter === "ALL" ? "border-primary/50 bg-primary/5" : "hover:bg-surface-hi",
          )}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">All offerings</p>
          <p className="mt-1 text-3xl font-medium tabular-nums">{summary.total}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{pct}% ready</p>
        </button>
        <StatCard label="Ready" value={summary.ready} tone="success" active={filter === "READY"} onClick={() => setFilter("READY")} />
        <StatCard label="In progress" value={summary.inProgress} tone="warning" active={filter === "IN_PROGRESS"} onClick={() => setFilter("IN_PROGRESS")} />
        <StatCard label="Not started" value={summary.notStarted} tone="muted" active={filter === "NOT_STARTED"} onClick={() => setFilter("NOT_STARTED")} />
      </div>

      <NeedsAttentionTray tray={tray} />

      {/* Per-offering checklist */}
      <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-soft">
        <table className="w-full text-[13px]">
          <thead className="border-b bg-surface-hi/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Offering</th>
              {CHECK_META.map((c) => (
                <th key={c.key} className="w-28 px-2 py-2 font-medium">{c.label}</th>
              ))}
              <th className="w-28 px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                  No offerings in this state.
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-surface-hi/40">
                <td className="px-3 py-2">
                  <Link href={`/admin/offerings/${r.id}`} className="font-medium hover:text-primary hover:underline">
                    {r.label}
                  </Link>
                  <span className="ml-2 text-[11px] text-muted-foreground tabular-nums">{r.done}/{r.total}</span>
                </td>
                {CHECK_META.map(({ key }) => {
                  const check = r.checks[key];
                  return (
                    <td key={key} className="px-2 py-2">
                      {/* The gate owns its own target — computed once in
                          `@/lib/readiness` and unit-tested there, so the link
                          cannot drift from the check it belongs to. */}
                      <Link
                        href={check.href}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors",
                          check.done
                            ? "text-green-700 hover:bg-green-50 dark:text-green-500 dark:hover:bg-green-950/40"
                            : "text-amber-700 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-950/40",
                        )}
                        title={check.done ? "Done — open anyway" : "Not set up — click to fix"}
                      >
                        {check.done
                          ? <Check className="h-3 w-3 flex-shrink-0" />
                          : <span className="text-sm leading-none">·</span>}
                        {key === "plans"
                          ? (check.done ? "3/6/12" : r.planDurations.length ? `${r.planDurations.join("/")}mo` : "none")
                          : check.count > 0 ? check.count.toLocaleString() : "none"}
                      </Link>
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label, value, tone, active, onClick,
}: {
  label: string; value: number; tone: "success" | "warning" | "muted"; active: boolean; onClick: () => void;
}) {
  const toneClass =
    tone === "success" ? "text-green-600 dark:text-green-500"
    : tone === "warning" ? "text-amber-600 dark:text-amber-500"
    : "text-muted-foreground";
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card p-4 text-left shadow-soft transition-colors",
        active ? "border-primary/50 bg-primary/5" : "hover:bg-surface-hi",
      )}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-medium tabular-nums", toneClass)}>{value}</p>
    </button>
  );
}

function StatusPill({ status }: { status: ReadinessRow["status"] }) {
  if (status === "READY") return <Badge variant="success" className="text-[10px]">Ready</Badge>;
  if (status === "NOT_STARTED") return <Badge variant="secondary" className="text-[10px]">Not started</Badge>;
  return <Badge variant="warning" className="text-[10px]">In progress</Badge>;
}
