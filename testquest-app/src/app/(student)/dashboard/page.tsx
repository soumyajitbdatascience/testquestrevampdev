"use client";

/**
 * Home (design 1b evolved per 3d) — context-scoped, resume-first.
 *
 * Body only: resume card → renew strip (T-7) → unlock banner (unsubscribed) →
 * subject cards (free-sample CTA or progress+continue). The header, context
 * switcher and nav come from the shared `(student)` shell, so this page no
 * longer renders chrome of its own.
 *
 * Scope comes from the `tq_ctx` cookie, resolved server-side — the page asks
 * for "my home", never for a class id, so it cannot request another class's.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Loader2, Lock, Play, BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { Paywall } from "@/components/student/paywall";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { MobileQuickNav } from "@/components/student/student-shell";

interface HomeData {
  needsOnboarding: boolean;
  context: {
    id: number; boardId: number; boardName: string; boardCode: string;
    classId: number; className: string; subscribed: boolean;
    passExpiresAt: string | null; daysLeft: number | null;
  };
  resume: {
    attemptId: number; testId: number; testName: string;
    answered: number; total: number;
    startedAt: string; durationMinutes: number | null;
  } | null;
  minPrice: number | null;
  totals: { subjects: number; tests: number; videos: number };
  subjects: Array<{
    id: number; name: string; testCount: number; videoCount: number;
    freeTestId: number | null; nextTest: { id: number; name: string } | null;
    attemptedCount: number; avgPct: number | null;
  }>;
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Minutes left on an in-flight timed attempt, or null when there is no clock
 * to show (a practice paper) or it has already run out. Display only — the
 * attempt engine decides what actually happens at zero.
 */
function minutesLeft(startedAt: string, durationMinutes: number | null): number | null {
  if (durationMinutes == null) return null;
  const endsAt = new Date(startedAt).getTime() + durationMinutes * 60_000;
  const mins = Math.ceil((endsAt - Date.now()) / 60_000);
  return mins > 0 ? mins : null;
}

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // No `needsOnboarding` branch here any more: the `(student)` layout has
  // already redirected a context-less student before this page ever mounts.
  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/student/home")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setLoadError(d.error || "Could not load your home"); return; }
        setData(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const ctx = data?.context;

  return (
    <>

      <main className="mx-auto max-w-[1100px] px-4 py-6 lg:px-6">
        {loading && !data ? (
          <div className="flex justify-center py-24">
            {loadError ? <p className="text-sm text-error">{loadError}</p> : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          </div>
        ) : data && ctx ? (
          <>
            {/* 1 · Resume card (1e) — always first when a paper is open. */}
            {data.resume && (() => {
              const left = minutesLeft(data.resume.startedAt, data.resume.durationMinutes);
              return (
                <button
                  onClick={() => router.push(`/attempts/${data.resume!.attemptId}`)}
                  data-testid="resume-card"
                  className="mb-3 w-full rounded-[18px] border-2 border-primary bg-wash px-4 py-[18px] text-left"
                >
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-primary">In progress</p>
                  <p className="mt-1 font-display text-[17px] font-bold text-ink">{data.resume.testName}</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-text-secondary">
                    Question {Math.min(data.resume.answered + 1, data.resume.total)} of {data.resume.total}
                    {/* Only shown while a timed paper still has time on it. */}
                    {left != null && <> · {left} min left</>}
                  </p>
                  <span className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-[12px] bg-primary px-[18px] text-[13.5px] font-bold text-primary-foreground">
                    Pick up where you left off <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                </button>
              );
            })()}

            {/* 2 · T-7 renew strip */}
            {ctx.subscribed && ctx.daysLeft != null && ctx.daysLeft <= 7 && (
              <button
                onClick={() => setPaywallOpen(true)}
                className="mb-4 flex w-full items-start gap-2.5 rounded-[14px] bg-warning-tint p-4 text-left"
              >
                <Clock className="h-4 w-4 flex-shrink-0 text-warning mt-0.5" />
                <span className="text-sm text-ink">
                  Your pass ends in <strong>{ctx.daysLeft} day{ctx.daysLeft === 1 ? "" : "s"}</strong>.{" "}
                  <span className="font-semibold text-warning">Renew now</span> — days add on after{" "}
                  {ctx.passExpiresAt ? fmtDate(ctx.passExpiresAt) : "expiry"}, never lost.
                </span>
              </button>
            )}

            {/* 3 · Unlock banner (unsubscribed) */}
            {!ctx.subscribed && data.minPrice != null && (
              <div className="relative mb-5 overflow-hidden rounded-[18px] bg-primary p-6 text-primary-foreground">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/30" />
                <h2 className="font-display text-[21px] font-bold leading-tight">Unlock all of {ctx.className}</h2>
                {/* Every figure is the API's — nothing here is a placeholder. */}
                <p className="mt-1.5 text-[13px] opacity-90">
                  All {data.totals.subjects} subject{data.totals.subjects === 1 ? "" : "s"} · {data.totals.tests} chapter-wise test
                  {data.totals.tests === 1 ? "" : "s"}
                  {data.totals.videos > 0 && <> · {data.totals.videos} video lesson{data.totals.videos === 1 ? "" : "s"}</>}
                </p>
                <p className="mt-0.5 text-[13px] opacity-90">
                  From ₹{data.minPrice} · One-time payment · no auto-renewal
                </p>
                <button
                  onClick={() => setPaywallOpen(true)}
                  className="mt-4 min-h-[44px] rounded-[12px] bg-white px-5 text-[13.5px] font-bold text-primary"
                >
                  See plans
                </button>
              </div>
            )}

            {/* Validity note (subscribed, not near expiry) */}
            {ctx.subscribed && ctx.passExpiresAt && (ctx.daysLeft == null || ctx.daysLeft > 7) && (
              <p className="mb-3 px-0.5 text-[11.5px] font-semibold text-text-secondary">
                Pass active · valid till {fmtDate(ctx.passExpiresAt)}
              </p>
            )}

            {/* 4 · Subject cards */}
            <div className="grid gap-4 lg:grid-cols-3 sm:grid-cols-2">
              {data.subjects.map((s) => (
                <div key={s.id} className="relative overflow-hidden rounded-[18px] border bg-card shadow-soft">
                  <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
                  <div className="px-4 pb-4 pt-[18px]">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-wash text-primary">
                        <BookOpen className="h-[19px] w-[19px]" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-[15px] font-bold text-ink">{s.name}</h3>
                        <p className="text-[11.5px] font-semibold text-text-secondary">
                          {s.testCount} chapter-wise test{s.testCount === 1 ? "" : "s"}
                          {s.videoCount > 0 && <> · {s.videoCount} video lesson{s.videoCount === 1 ? "" : "s"}</>}
                        </p>
                      </div>
                    </div>

                    {ctx.subscribed ? (
                      <>
                        <div className="mt-3.5">
                          <div className="flex items-baseline justify-between text-[13px] font-semibold">
                            <span className="text-text-secondary">{s.attemptedCount} of {s.testCount} tests attempted</span>
                            {s.avgPct != null && (
                              <span className="font-display text-[13px] font-extrabold text-accent">{s.avgPct}%</span>
                            )}
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-wash">
                            <div
                              className="h-1.5 rounded-full bg-primary transition-[width]"
                              style={{ width: `${s.testCount ? Math.min(100, Math.round((s.attemptedCount / s.testCount) * 100)) : 0}%` }}
                            />
                          </div>
                        </div>
                        {/* The CTA names the paper it opens. With every test in
                            the subject already sat there is nothing to name, so
                            it reverts to the subject rather than inventing one. */}
                        <Link
                          href={s.nextTest ? `/tests/${s.nextTest.id}` : `/offerings/${s.id}`}
                          className="mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-[7px] rounded-[12px] bg-primary px-3 text-[13.5px] font-bold text-primary-foreground"
                        >
                          <Play className="h-3.5 w-3.5 flex-shrink-0 fill-current" strokeWidth={0} />
                          <span className="truncate">
                            {s.nextTest ? `Continue · ${s.nextTest.name}` : "Revise this subject"}
                          </span>
                        </Link>
                      </>
                    ) : (
                      <>
                        {s.freeTestId ? (
                          <Link
                            href={`/tests/${s.freeTestId}`}
                            className="mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-[7px] rounded-[12px] bg-wash px-3 text-[13.5px] font-bold text-primary"
                          >
                            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">Try your free {s.name.split(" ")[0]} test</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/offerings/${s.id}`}
                            className="mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-[7px] rounded-[12px] bg-wash px-3 text-[13.5px] font-bold text-primary"
                          >
                            Browse chapter tests
                          </Link>
                        )}
                        {/* A lock is a doorway: the count is real, and the
                            banner above is how it opens. */}
                        {s.testCount > (s.freeTestId ? 1 : 0) && (
                          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-text-secondary">
                            <Lock className="h-3 w-3" /> {s.testCount - (s.freeTestId ? 1 : 0)} in pass
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {data.subjects.length === 0 && (
                <div className="col-span-full rounded-[18px] border bg-card p-10 text-center text-sm text-text-secondary">
                  No subjects published for {ctx.className} yet — check back soon.
                </div>
              )}
            </div>

            <MobileQuickNav />
            <PoweredByTestquest />
          </>
        ) : null}
      </main>

      {ctx && (
        <Paywall
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          boardId={ctx.boardId}
          classId={ctx.classId}
          returnTo="/dashboard"
        />
      )}
    </>
  );
}
