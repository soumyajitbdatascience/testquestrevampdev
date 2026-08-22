"use client";

/**
 * My progress (design 1g): subject pill tabs, score-trend line (last 8
 * attempts), per-subject completion bars in sequential purples, the
 * "Worth another look" weak-subjects card deep-linking to practice, and
 * **Recent attempts** — which used to be a top-level "History" page under the
 * legacy header. It is one section here now; `/my-attempts` redirects in.
 *
 * Everything on this page is scoped server-side to the active board+class,
 * so switching class re-scopes the whole page rather than blending two.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { MobileQuickNav } from "@/components/student/student-shell";
import { Loader2, ArrowRight, AlertTriangle, BookOpenCheck, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip,
} from "recharts";

interface DashboardData {
  subjectBreakdown: Array<{ subjectId: number; offeringId: number; subject: string; avgPercentage: number; attemptCount: number }>;
  scoreTrend: Array<{ percentage: number; subject: string }>;
}
interface HomeSubject { id: number; name: string; testCount: number; attemptedCount: number; avgPct: number | null }
interface AttemptRow {
  id: number; status: string; isPractice: boolean;
  score: number | null; totalMarks: number; percentage: string | number | null;
  timeSpentSeconds: number; startedAt: string; finishedAt: string | null;
  test: { id: number; name: string; subject: { name: string }; class: { name: string } };
}

function fmtAttemptDate(s: string): string {
  const d = new Date(s);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return "today";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function scoreColor(pct: number) {
  if (pct >= 75) return "var(--score-strong)";
  if (pct >= 50) return "var(--score-on-track)";
  return "var(--score-needs-work)";
}

const BAR_COLORS = ["var(--primary)", "var(--accent)", "var(--lavender)"];

export default function ProgressPage() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [subjects, setSubjects] = useState<HomeSubject[]>([]);
  // One filter drives both the trend and Recent attempts (1f). It is held as
  // an offering id, not a subject name: the attempts API filters by offering,
  // and names are not unique enough to key anything on.
  const [activeOffering, setActiveOffering] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptPage, setAttemptPage] = useState(1);
  const [attemptPages, setAttemptPages] = useState(1);
  const [attemptTotal, setAttemptTotal] = useState(0);
  // "View all" expands in place rather than routing to a history page — that
  // page is exactly what this section replaced.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/student/dashboard").then((r) => r.json()),
      fetch("/api/student/home").then((r) => r.json()),
    ]).then(([d, h]) => {
      if (d.ok) setDash(d.data);
      if (h.ok && !h.data.needsOnboarding) setSubjects(h.data.subjects);
    }).finally(() => setLoading(false));
  }, []);

  // Recent attempts paginate on their own — the charts above don't need to
  // reload when someone pages through their history. The subject filter is
  // applied server-side so it narrows the whole history, not just this page.
  useEffect(() => {
    const params = new URLSearchParams({
      page: String(attemptPage),
      limit: expanded ? "50" : "10",
    });
    if (activeOffering != null) params.set("offeringId", String(activeOffering));
    fetch(`/api/student/attempts?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setAttempts(d.data.attempts);
        setAttemptPages(d.data.totalPages);
        setAttemptTotal(d.data.total);
      })
      .catch(() => {});
  }, [attemptPage, expanded, activeOffering]);

  const activeSubjectName = dash?.subjectBreakdown.find((s) => s.offeringId === activeOffering)?.subject ?? null;

  const trend = useMemo(() => {
    const rows = (dash?.scoreTrend ?? [])
      .filter((t) => activeSubjectName == null || t.subject === activeSubjectName)
      .slice(0, 8).reverse();
    return rows.map((t, i) => ({ i: i + 1, pct: Number(t.percentage) }));
  }, [dash, activeSubjectName]);

  const weak = (dash?.subjectBreakdown ?? [])
    .filter((s) => s.avgPercentage != null && s.avgPercentage < 60 && s.attemptCount > 0)
    .slice(0, 3);

  const pills: Array<{ offeringId: number | null; label: string }> = [
    { offeringId: null, label: "All" },
    ...(dash?.subjectBreakdown ?? []).map((s) => ({ offeringId: s.offeringId, label: s.subject })),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <header className="mb-2">
        <h1 className="font-display text-[22px] font-extrabold leading-[1.2] tracking-tight text-ink">My progress</h1>
        <p className="mt-[3px] text-[12.5px] font-semibold text-text-secondary">
          Scores, coverage, and where to focus next
        </p>
      </header>
      <div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Subject pills — filter the trend and Recent attempts together. */}
            <div className="flex flex-wrap gap-2" data-testid="subject-pills">
              {pills.map((p) => {
                const on = p.offeringId === activeOffering;
                return (
                  <button
                    key={p.offeringId ?? "all"}
                    onClick={() => { setActiveOffering(p.offeringId); setAttemptPage(1); }}
                    aria-pressed={on}
                    className={cn(
                      "h-9 rounded-full px-3.5 text-[13px] font-bold transition-colors",
                      on ? "bg-primary text-primary-foreground" : "bg-wash text-text-secondary hover:text-ink",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Score trend */}
            <div className="rounded-[18px] border bg-card p-5">
              <h2 className="font-display text-[15px] font-bold text-ink mb-3">Score trend — last {trend.length} attempts</h2>
              {trend.length < 2 ? (
                <p className="py-8 text-center text-[13px] text-text-secondary">Take a couple of tests to see your trend.</p>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="i" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} ticks={[25, 50, 75]} tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                        formatter={(v) => [`${v}%`, "Score"]}
                        labelFormatter={(l) => `Attempt ${l}`}
                      />
                      <Line
                        type="monotone" dataKey="pct"
                        stroke="var(--primary)" strokeWidth={2.5}
                        dot={{ fill: "var(--lavender)", r: 3, strokeWidth: 0 }}
                        activeDot={{ fill: "var(--primary)", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Completion bars */}
            <div className="rounded-[18px] border bg-card p-5">
              <h2 className="font-display text-[15px] font-bold text-ink mb-4">Coverage by subject</h2>
              <div className="space-y-3.5">
                {subjects.filter((s) => s.testCount > 0).slice(0, 10).map((s, i) => {
                  const pct = Math.min(100, Math.round((s.attemptedCount / s.testCount) * 100));
                  return (
                    <Link key={s.id} href={`/offerings/${s.id}`} className="block group">
                      <div className="flex items-baseline justify-between text-[12.5px]">
                        <span className="font-bold text-ink group-hover:text-primary">{s.name}</span>
                        <span className="font-semibold text-text-secondary">{s.attemptedCount}/{s.testCount}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-wash">
                        <div className="h-2 rounded-full transition-[width]" style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                      </div>
                    </Link>
                  );
                })}
                {subjects.filter((s) => s.testCount > 0).length === 0 && (
                  <p className="py-6 text-center text-[13px] text-text-secondary">No subjects yet.</p>
                )}
              </div>
            </div>

            {/* Worth another look */}
            {weak.length > 0 && (
              <div className="relative overflow-hidden rounded-[18px] border bg-card p-5">
                <div className="absolute inset-x-0 top-0 h-1 bg-[color:var(--warning)]" />
                <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-ink mb-3">
                  <AlertTriangle className="h-4 w-4 text-[color:var(--warning)]" /> Worth another look
                </h2>
                <div className="space-y-2">
                  {/* Deep-linked by offering id from the API — this used to
                      match subjects by name, which broke the link whenever a
                      name repeated or changed. */}
                  {weak.map((w) => (
                    <div key={w.offeringId} className="flex items-center gap-2.5 rounded-[12px] bg-wash px-3.5 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{w.subject}</span>
                      <span className="font-display text-[13px] font-extrabold text-[color:var(--warning)]">
                        {Math.round(w.avgPercentage)}%
                      </span>
                      <Link
                        href={`/offerings/${w.offeringId}`}
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-[8px] bg-primary px-2.5 text-[11.5px] font-bold text-primary-foreground"
                      >
                        Practice <ArrowRight className="h-2.5 w-2.5" strokeWidth={2.5} />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent attempts (1f) — the former standalone "History" page. */}
            <div className="overflow-hidden rounded-[18px] border bg-card" data-testid="recent-attempts">
              <div className="flex items-baseline justify-between gap-3 px-4 pb-2.5 pt-3.5">
                <h2 className="font-display text-[15px] font-bold text-ink">Recent attempts</h2>
                {/* Expands in place; there is no history page to send them to
                    any more, and re-adding one would undo the consolidation. */}
                {!expanded && attemptTotal > attempts.length && (
                  <button
                    onClick={() => { setExpanded(true); setAttemptPage(1); }}
                    className="text-[11px] font-bold text-primary-deep"
                  >
                    View all {attemptTotal}
                  </button>
                )}
              </div>

              {attempts.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-wash text-primary">
                    <BookOpenCheck className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-[13px] font-bold text-ink">
                    No attempts in {activeSubjectName ?? "this class"} yet
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-text-secondary">Try a free test to get started.</p>
                  <Link
                    href="/dashboard"
                    className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] bg-primary px-4 text-[13px] font-bold text-primary-foreground"
                  >
                    Find a test <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <>
                  <ul>
                    {attempts.map((a) => {
                      const done = a.status === "COMPLETED";
                      const pct = Number(a.percentage ?? 0);
                      return (
                        <li key={a.id} className="border-t">
                          <Link
                            href={done ? `/attempts/${a.id}/result` : `/attempts/${a.id}`}
                            className="flex min-h-[44px] items-center gap-3 px-4 py-[11px] hover:bg-wash"
                          >
                            <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-wash font-display text-sm font-extrabold text-primary">
                              {a.test.subject.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[13px] font-bold text-ink">{a.test.name}</span>
                                {!done && (
                                  <span className="flex-shrink-0 rounded-full bg-wash px-[7px] py-0.5 text-[9.5px] font-bold text-primary-deep">
                                    In progress
                                  </span>
                                )}
                              </span>
                              <span className="block truncate text-[11px] font-semibold text-text-secondary">
                                {a.test.subject.name} · {fmtAttemptDate(a.startedAt)}
                              </span>
                            </span>
                            {done ? (
                              <span className="flex-shrink-0 text-right">
                                <span className="block font-display text-[15px] font-extrabold" style={{ color: scoreColor(pct) }}>
                                  {Math.round(pct)}%
                                </span>
                                <span className="block text-[10.5px] font-semibold text-text-secondary">
                                  {a.score ?? 0} / {a.totalMarks}
                                </span>
                              </span>
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-text-secondary" strokeWidth={2.5} />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {attemptPages > 1 && (
                    <div className="flex items-center justify-between border-t px-4 py-3 text-[12.5px]">
                      <button
                        onClick={() => setAttemptPage((p) => Math.max(1, p - 1))}
                        disabled={attemptPage === 1}
                        className="min-h-[44px] rounded-[10px] px-3 font-bold text-text-secondary disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="font-semibold text-text-secondary">Page {attemptPage} of {attemptPages}</span>
                      <button
                        onClick={() => setAttemptPage((p) => Math.min(attemptPages, p + 1))}
                        disabled={attemptPage === attemptPages}
                        className="min-h-[44px] rounded-[10px] px-3 font-bold text-text-secondary disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <MobileQuickNav />
        <PoweredByTestquest />
      </div>
    </div>
  );
}
