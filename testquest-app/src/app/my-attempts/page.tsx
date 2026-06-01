"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StudentHeader, PageHeader } from "@/components/student/student-header";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, Loader2, ChevronLeft, ChevronRight, Clock, ArrowRight } from "lucide-react";

interface Attempt {
  id: number;
  status: string;
  isPractice: boolean;
  score: number | null;
  totalMarks: number;
  percentage: string | number | null;
  timeSpentSeconds: number;
  startedAt: string;
  finishedAt: string | null;
  test: { id: number; name: string; subject: { name: string }; class: { name: string } };
}

function scoreColor(pct: number) {
  if (pct >= 75) return "var(--score-strong)";
  if (pct >= 50) return "var(--score-on-track)";
  return "var(--score-needs-work)";
}

export default function MyAttemptsPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/student/attempts?page=${page}`).then((r) => r.json()).then((d) => {
      if (d.ok) { setAttempts(d.data.attempts); setTotalPages(d.data.totalPages); }
    }).finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="min-h-screen bg-background">
      <StudentHeader />

      <div className="container mx-auto px-6 lg:px-12 py-10 max-w-4xl">
        <PageHeader title="History" subtitle="All your test attempts in one place." />

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : attempts.length === 0 ? (
          <div className="rounded-[22px] border-2 border-dashed bg-surface/30 p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-dim text-primary">
              <BookOpenCheck className="h-7 w-7" />
            </div>
            <h3 className="mt-5 font-display text-2xl">No attempts yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Pick a test and try your first one</p>
            <Button asChild className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
              <Link href="/tests">Browse tests <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border bg-surface overflow-hidden divide-y">
              {attempts.map((a) => {
                const inProgress = a.status === "IN_PROGRESS" || a.status === "PAUSED";
                const href = inProgress ? `/attempts/${a.id}` : `/attempts/${a.id}/result`;
                const pct = a.percentage !== null ? Number(a.percentage) : null;
                const color = pct !== null ? scoreColor(pct) : "var(--muted-foreground)";
                return (
                  <Link key={a.id} href={href} className="flex items-center gap-4 p-5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[12px] bg-primary-dim text-primary font-display">
                      {a.test.subject.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{a.test.name}</p>
                        {a.isPractice && (
                          <span className="inline-flex items-center rounded-full bg-primary-dim text-primary px-2 py-0.5 text-[10px] font-medium">Practice</span>
                        )}
                        {inProgress && (
                          <span className="inline-flex items-center rounded-full bg-primary-dim text-primary px-2 py-0.5 text-[10px] font-medium">
                            {a.status === "PAUSED" ? "Paused" : "In progress"}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{a.test.class.name} · {a.test.subject.name}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(a.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {pct !== null ? (
                        <>
                          <p className="font-display text-2xl" style={{ color }}>{pct}%</p>
                          <p className="text-xs text-muted-foreground">{a.score} / {a.totalMarks}</p>
                        </>
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                  Next<ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
        <PoweredByTestquest />
      </div>
    </div>
  );
}
