"use client";

/**
 * My subscriptions (design 1f): active/expired pass cards with the renew CTA
 * ("days add on — you never lose days"), payment history, and grandfathered
 * per-test purchases ("yours forever").
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { MobileQuickNav } from "@/components/student/student-shell";
import { Loader2, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Paywall } from "@/components/student/paywall";

interface PassCard {
  boardId: number; boardName: string; classId: number; className: string;
  durationMonths: number | null; startsAt: string | null; expiresAt: string | null;
  orderId: number | null; active: boolean; daysLeft: number; elapsedPct: number;
  /** The class the header is currently switched to — sorted first by the API. */
  isActiveContext: boolean;
  /** A class held but never bought (1g). No pass, no history — just a doorway. */
  free: boolean;
  /** Cheapest buyable term for a free-browsing class; null when none is priced. */
  minPrice: number | null;
}
interface HistoryRow { id: number; description: string; amount: number; date: string; method: string }
interface PurchasedTest { testId: number; name: string; expiresAt: string | null }

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function MySubscriptionsPage() {
  const [passes, setPasses] = useState<PassCard[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [tests, setTests] = useState<PurchasedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewScope, setRenewScope] = useState<{ boardId: number; classId: number } | null>(null);

  useEffect(() => {
    fetch("/api/student/subscriptions").then((r) => r.json()).then((d) => {
      if (d.ok) { setPasses(d.data.passes); setHistory(d.data.history); setTests(d.data.purchasedTests); }
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <header className="mb-2">
        <h1 className="font-display text-[22px] font-extrabold leading-[1.2] tracking-tight text-ink">My subscriptions</h1>
        <p className="mt-[3px] text-[12.5px] font-semibold text-text-secondary">
          Your passes, payments, and purchases
        </p>
      </header>
      <div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-8 mt-6">
            {/* Pass cards */}
            <section className="space-y-4">
              {passes.length === 0 && (
                <div className="rounded-[18px] border bg-card p-8 text-center">
                  <p className="text-[13px] font-semibold text-text-secondary">No class pass yet.</p>
                  <Link
                    href="/dashboard"
                    className="mt-3 inline-flex min-h-[44px] items-center rounded-[12px] bg-primary px-5 text-[13px] font-bold text-primary-foreground"
                  >
                    See plans
                  </Link>
                </div>
              )}
              {passes.map((p) => (
                <div
                  key={`${p.boardId}-${p.classId}`}
                  data-testid={p.free ? "free-class-card" : "pass-card"}
                  className={cn(
                    "relative overflow-hidden rounded-[18px] border bg-card",
                    !p.free && "shadow-soft",
                    !p.free && !p.active && "opacity-90",
                  )}
                >
                  {/* Only a real pass earns the coloured top bar. */}
                  {!p.free && <div className={cn("absolute inset-x-0 top-0 h-1", p.active ? "bg-success" : "bg-border")} />}

                  <div className="px-4 pb-4 pt-[18px]">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <h3 className="flex flex-wrap items-center gap-2 font-display text-[16px] font-bold text-ink">
                          {p.boardName} · {p.className}
                          {p.isActiveContext && (
                            <span className="rounded-full bg-wash px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-primary">
                              Current class
                            </span>
                          )}
                        </h3>
                        <p className="mt-0.5 text-[12.5px] font-semibold text-text-secondary">
                          {p.free ? (
                            <>Free browsing — no pass yet · 1 free test per subject</>
                          ) : (
                            <>
                              {p.durationMonths ? `${p.durationMonths}-month pass · ` : ""}
                              {p.active
                                ? <>valid till {p.expiresAt ? fmtDate(p.expiresAt) : "—"} · <strong>{p.daysLeft} days left</strong></>
                                : <>ended {p.expiresAt ? fmtDate(p.expiresAt) : "—"} — your scores and progress are saved</>}
                            </>
                          )}
                        </p>
                      </div>
                      <span className={cn(
                        "flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        p.free
                          ? "bg-wash text-primary-deep"
                          : p.active ? "bg-success-tint text-success" : "bg-error-tint text-error",
                      )}>
                        {p.free ? "Free" : p.active ? "Active" : "Expired"}
                      </span>
                    </div>

                    {!p.free && p.active && (
                      <div className="mt-3 h-1.5 rounded-full bg-wash">
                        <div className="h-1.5 rounded-full bg-success transition-[width]" style={{ width: `${p.elapsedPct}%` }} />
                      </div>
                    )}

                    {p.free ? (
                      /* A quiet doorway, never a nag — and the price is the
                         real cheapest term, or the CTA simply doesn't quote one. */
                      <button
                        onClick={() => setRenewScope({ boardId: p.boardId, classId: p.classId })}
                        className="mt-3 min-h-[44px] rounded-[12px] border border-primary px-[18px] text-[13px] font-bold text-primary"
                      >
                        {p.minPrice != null ? <>See plans — from ₹{p.minPrice}</> : "See plans"}
                      </button>
                    ) : (
                      <div className="mt-3.5 flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setRenewScope({ boardId: p.boardId, classId: p.classId })}
                          className={cn(
                            "min-h-[44px] rounded-[12px] px-[22px] text-[13.5px] font-bold",
                            p.active ? "bg-primary text-primary-foreground" : "border border-primary text-primary",
                          )}
                        >
                          Renew
                        </button>
                        {p.active && (
                          <p className="flex-1 text-[11px] font-semibold leading-[1.4] text-text-secondary">
                            Renewing adds time from your current expiry — you never lose days.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>

            {/* Payment history */}
            {history.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-bold text-ink mb-3">Payment history</h2>
                <div className="overflow-hidden rounded-[18px] border bg-card">
                  {history.map((h, i) => (
                    <div key={h.id} className={cn("flex items-center justify-between gap-3 p-4", i > 0 && "border-t")}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{h.description}</p>
                        <p className="text-[11px] font-semibold text-text-secondary">{fmtDate(h.date)} · {h.method}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-sm font-bold text-ink">₹{h.amount}</span>
                        <Receipt className="h-4 w-4 text-text-muted-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Grandfathered purchases */}
            {tests.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-bold text-ink mb-1">Your purchased tests</h2>
                <p className="mb-3 text-[12.5px] font-semibold text-text-secondary">Bought before class passes — yours forever.</p>
                <div className="overflow-hidden rounded-[18px] border bg-card">
                  {tests.map((t, i) => (
                    <Link key={t.testId} href={`/tests/${t.testId}`} className={cn("flex items-center justify-between gap-3 p-4 hover:bg-wash", i > 0 && "border-t")}>
                      <p className="truncate text-sm font-semibold text-ink">{t.name}</p>
                      <span className="text-[11.5px] font-semibold text-text-secondary">
                        {t.expiresAt ? `till ${fmtDate(t.expiresAt)}` : "lifetime"}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        <MobileQuickNav />
        <PoweredByTestquest />
      </div>

      {renewScope && (
        <Paywall
          open
          onClose={() => setRenewScope(null)}
          boardId={renewScope.boardId}
          classId={renewScope.classId}
          returnTo="/my-subscriptions"
        />
      )}
    </div>
  );
}
