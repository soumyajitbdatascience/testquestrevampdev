"use client";

/**
 * Plans & pricing (design 2e): grid of board+class rows with 3/6/12 price
 * inputs, plus the live student paywall preview.
 *
 * Pricing 30 rows by hand was what kept Launch Readiness at 0 — so the grid is
 * built around three shortcuts rather than 90 keystrokes: fill 6 and 12 from
 * the 3-month price, apply one row to every class in its board, and save every
 * edited row in one go. Anything bulk confirms with a count and leaves an Undo.
 *
 * Two things this screen must never do: hide a priced-but-inactive term (that
 * is the silent reason an offering stays red), and let readiness go stale after
 * a save — the count at the top is refetched from the same
 * `/api/admin/launch-readiness` the home page reads.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Copy, Eye, Wand2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceCell { price: number; isActive: boolean }
interface PlanRow {
  boardId: number; boardName: string; boardCode: string;
  classId: number; className: string;
  offeringCount: number; testCount: number; hasContent: boolean;
  prices: { 3: PriceCell | null; 6: PriceCell | null; 12: PriceCell | null };
}

const DURATIONS = [3, 6, 12] as const;
type Duration = (typeof DURATIONS)[number];
type Cells = Record<Duration, string>;
type Draft = Record<string, Cells>;
type Prices = Record<Duration, number | null>;
/** The payload both a save and its Undo speak. */
type RowPayload = { boardId: number; classId: number; prices: Prices };

const keyOf = (r: { boardId: number; classId: number }) => `${r.boardId}:${r.classId}`;
const INVALID = "Prices are whole rupees — no decimals or negatives.";

/**
 * Server state → editable strings. An inactive term still shows its stored
 * price: blanking it is what let a priced-but-off plan look like "never priced"
 * and block readiness with no visible cause.
 */
function cellsOf(r: PlanRow): Cells {
  const v = (c: PriceCell | null) => (c && c.price > 0 ? String(Math.round(c.price)) : "");
  return { 3: v(r.prices[3]), 6: v(r.prices[6]), 12: v(r.prices[12]) };
}

/**
 * What is actually on sale right now. Undo restores through this shape, so a
 * term that was priced-but-inactive comes back as `null` — which deactivates
 * without touching the stored price — rather than being switched on by mistake.
 */
function livePricesOf(r: PlanRow): Prices {
  const v = (c: PriceCell | null) => (c && c.isActive && c.price > 0 ? Math.round(c.price) : null);
  return { 3: v(r.prices[3]), 6: v(r.prices[6]), 12: v(r.prices[12]) };
}

/**
 * Full server state of a row, price *and* active flag. Change detection has to
 * see the flag: clearing a term keeps its stored price and only switches it
 * off, so comparing the visible numbers alone would call that "unchanged" and
 * leave the grid showing a draft the server just contradicted.
 */
function signatureOf(r: PlanRow): string {
  return DURATIONS.map((d) => `${r.prices[d]?.price ?? ""}:${r.prices[d]?.isActive ?? ""}`).join("|");
}

function cellError(v: string): boolean {
  const t = v.trim();
  return t !== "" && !/^\d+$/.test(t);
}
function toPrices(c: Cells): Prices {
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  return { 3: n(c[3]), 6: n(c[6]), 12: n(c[12]) };
}
const hasAnyPrice = (c: Cells) => DURATIONS.some((d) => c[d].trim() !== "" && Number(c[d]) > 0);
const sameCells = (a: Cells, b: Cells) => DURATIONS.every((d) => a[d] === b[d]);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansPageInner />
    </Suspense>
  );
}

function PlansPageInner() {
  const router = useRouter();
  // Launch Readiness deep-links here scoped to the board+class row that needs
  // a price, so the grid can put that row in front of the user.
  const searchParams = useSearchParams();
  const focusBoard = searchParams.get("boardId");
  const focusClass = searchParams.get("classId");
  const focusKey = focusBoard && focusClass ? `${focusBoard}:${focusClass}` : null;

  const [rows, setRows] = useState<PlanRow[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(focusKey);
  const [copyFrom, setCopyFrom] = useState<PlanRow | null>(null);
  const [mult, setMult] = useState<{ 6: string; 12: string }>({ 6: "2", 12: "3.6" });
  const [toast, setToast] = useState<{ msg: string; tone?: "error"; undo?: () => void } | null>(null);
  const [readiness, setReadiness] = useState<{ ready: number; total: number } | null>(null);

  /**
   * Last known server signatures, read only inside the reload callback — never
   * during render, where `rows` is the source of truth for what is saved.
   */
  const serverSig = useRef<Record<string, string>>({});
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const applyServer = useCallback((list: PlanRow[]) => {
    const prevSig = serverSig.current;
    serverSig.current = Object.fromEntries(list.map((r) => [keyOf(r), signatureOf(r)]));
    setRows(list);
    // Reloading must not throw away edits typed into rows the save didn't touch,
    // but a row the server did change snaps back to what is actually stored.
    setDraft((prev) => {
      const next: Draft = {};
      for (const r of list) {
        const k = keyOf(r);
        const changedOnServer = prevSig[k] !== signatureOf(r);
        next[k] = !prev[k] || changedOnServer ? cellsOf(r) : prev[k];
      }
      return next;
    });
  }, []);

  const loadPlans = useCallback(async () => {
    const d = await fetch("/api/admin/plans", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    if (d?.ok) applyServer(d.data as PlanRow[]);
  }, [applyServer]);

  /**
   * Readiness is refetched, not inferred: the grid writes `tq_b2c_plans` and
   * this reads the endpoint that resolves the very same rows, so "X of N ready"
   * here can never disagree with the home page.
   */
  const refreshReadiness = useCallback(async () => {
    const d = await fetch("/api/admin/launch-readiness", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    if (!d?.ok) return null;
    const summary = d.data.summary as { ready: number; total: number };
    setReadiness({ ready: summary.ready, total: summary.total });
    return summary;
  }, []);

  useEffect(() => {
    Promise.all([loadPlans(), refreshReadiness()]).finally(() => setLoading(false));
  }, [loadPlans, refreshReadiness]);

  // A toast that never leaves keeps offering an Undo for a change long gone.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  // Land the deep link on the row itself, cursor in the 3-month box.
  useEffect(() => {
    if (loading || !focusKey) return;
    const el = rowRefs.current[focusKey];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.querySelector("input")?.focus();
  }, [loading, focusKey]);

  /**
   * Every write goes through here: one request, one transaction, one toast with
   * the count and (for anything bulk or destructive) the way back.
   */
  async function commit(payload: RowPayload[], describe: (n: number) => string, undoTo?: RowPayload[], busy = "bulk") {
    setBusyKey(busy);
    const before = readiness?.ready ?? null;

    const res = await fetch("/api/admin/plans/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: payload }),
    })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "Could not reach the server." }));

    if (!res.ok) {
      setBusyKey(null);
      setToast({ msg: res.error || "Save failed", tone: "error" });
      return;
    }

    await Promise.all([loadPlans(), refreshReadiness()]).then(([, summary]) => {
      // The home page is a client fetch, but its cached render sits in the
      // router cache — drop it so going back shows the new counts.
      router.refresh();
      setBusyKey(null);
      const applied = Number(res.data?.applied ?? payload.length);
      const gained = before != null && summary ? summary.ready - before : 0;
      setToast({
        msg: describe(applied) + (gained > 0 ? ` · ${plural(gained, "offering")} now ready` : ""),
        undo: undoTo
          ? () => commit(undoTo, (n) => `Reverted ${plural(n, "row")}`)
          : undefined,
      });
    });
  }

  function saveRow(r: PlanRow) {
    const k = keyOf(r);
    const c = draft[k];
    if (DURATIONS.some((d) => cellError(c[d]))) return setToast({ msg: INVALID, tone: "error" });
    commit(
      [{ boardId: r.boardId, classId: r.classId, prices: toPrices(c) }],
      () => `Saved ${r.boardCode} · ${r.className}`,
      [{ boardId: r.boardId, classId: r.classId, prices: livePricesOf(r) }],
      k,
    );
  }

  /** Rows the user has edited but not yet saved — what "Save all" acts on. */
  const dirtyRows = rows.filter(
    (r) => r.hasContent && draft[keyOf(r)] && !sameCells(draft[keyOf(r)], cellsOf(r)),
  );

  function saveAll() {
    const invalid = dirtyRows.some((r) => DURATIONS.some((d) => cellError(draft[keyOf(r)][d])));
    if (invalid) return setToast({ msg: INVALID, tone: "error" });
    commit(
      dirtyRows.map((r) => ({ boardId: r.boardId, classId: r.classId, prices: toPrices(draft[keyOf(r)]) })),
      (n) => `Priced ${plural(n, "row")}`,
      dirtyRows.map((r) => ({ boardId: r.boardId, classId: r.classId, prices: livePricesOf(r) })),
    );
  }

  /** ×2 / ×3.6 off the 3-month price — type once per row instead of three times. */
  function fillAcross(r: PlanRow) {
    const k = keyOf(r);
    const base = Number(draft[k]?.[3] ?? "");
    if (!base || base <= 0) return setToast({ msg: "Type a 3-month price first.", tone: "error" });
    const m6 = Number(mult[6]);
    const m12 = Number(mult[12]);
    setDraft((prev) => ({
      ...prev,
      [k]: {
        3: String(base),
        6: m6 > 0 ? String(Math.round(base * m6)) : prev[k][6],
        12: m12 > 0 ? String(Math.round(base * m12)) : prev[k][12],
      },
    }));
  }

  function fillAllRows() {
    const m6 = Number(mult[6]);
    const m12 = Number(mult[12]);
    const targets = rows.filter((r) => r.hasContent && Number(draft[keyOf(r)]?.[3]) > 0);
    if (targets.length === 0) {
      return setToast({ msg: "Nothing to fill — no row has a 3-month price yet.", tone: "error" });
    }
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of targets) {
        const k = keyOf(r);
        const base = Number(prev[k][3]);
        next[k] = {
          3: String(base),
          6: m6 > 0 ? String(Math.round(base * m6)) : prev[k][6],
          12: m12 > 0 ? String(Math.round(base * m12)) : prev[k][12],
        };
      }
      return next;
    });
    setToast({ msg: `Filled 6 & 12 months on ${plural(targets.length, "row")} — review, then Save all.` });
  }

  // "Copy to all classes" stays inside the board: boards are priced differently,
  // and a cross-board overwrite is not something to do by accident.
  const copyTargets = copyFrom
    ? rows.filter((r) => r.boardId === copyFrom.boardId && r.hasContent && keyOf(r) !== keyOf(copyFrom))
    : [];

  function runCopy() {
    if (!copyFrom) return;
    const src = copyFrom;
    const c = draft[keyOf(src)];
    setCopyFrom(null);
    const prices = toPrices(c);
    const affected = [src, ...copyTargets];
    commit(
      affected.map((r) => ({ boardId: r.boardId, classId: r.classId, prices })),
      (n) => `Priced ${plural(n, "row")} in ${src.boardCode}`,
      affected.map((r) => ({ boardId: r.boardId, classId: r.classId, prices: livePricesOf(r) })),
    );
  }

  const preview = rows.find((r) => keyOf(r) === previewKey);
  const previewDraft = preview ? draft[keyOf(preview)] : null;
  const busy = busyKey !== null;
  const readyPct = readiness && readiness.total > 0 ? Math.round((readiness.ready / readiness.total) * 100) : 0;

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader title="Plans & pricing" subtitle="3 / 6 / 12-month pass prices per board and class" />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px] items-start">
          <div className="space-y-4">
            {/* Readiness, recomputed after every save — the reason to price at all. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted-2">Launch readiness</span>
              <span className="font-display text-[15px] font-bold text-ink tabular-nums">
                {readiness ? `${readiness.ready} of ${readiness.total}` : "—"}
                <span className="ml-1 text-[12px] font-normal text-text-muted-2">offerings ready to sell</span>
              </span>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${readyPct}%` }} />
              </div>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Link href="/admin" className="ml-auto text-[12px] font-medium text-primary hover:underline">
                Open launch readiness <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>

            {/* Bulk toolbar */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-[13px]">
              <span className="text-text-muted-2">6 mo =</span>
              <MultInput value={mult[6]} onChange={(v) => setMult((m) => ({ ...m, 6: v }))} />
              <span className="text-text-muted-2">× 3 mo · 12 mo =</span>
              <MultInput value={mult[12]} onChange={(v) => setMult((m) => ({ ...m, 12: v }))} />
              <span className="text-text-muted-2">× 3 mo</span>
              <Button variant="outline" size="sm" onClick={fillAllRows} disabled={busy}>
                <Wand2 className="h-3.5 w-3.5" /> Fill every row
              </Button>
              <Button size="sm" onClick={saveAll} disabled={busy || dirtyRows.length === 0} className="ml-auto">
                {busyKey === "bulk" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save all changes{dirtyRows.length > 0 ? ` (${dirtyRows.length})` : ""}
              </Button>
            </div>

            <div className="rounded-2xl border bg-card overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-text-muted-2">
                    <th className="px-4 py-2.5">Board · Class</th>
                    <th className="px-2 py-2.5">3 mo</th>
                    <th className="px-2 py-2.5">6 mo</th>
                    <th className="px-2 py-2.5">12 mo</th>
                    <th className="px-2 py-2.5">Status</th>
                    <th className="px-2 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const k = keyOf(r);
                    const d = draft[k] ?? { 3: "", 6: "", 12: "" };
                    const invalid = DURATIONS.some((mo) => cellError(d[mo]));
                    const dirty = !sameCells(d, cellsOf(r));
                    // Priced yet switched off — the trap this grid exists to surface.
                    const pricedButOff = DURATIONS.some((mo) => r.prices[mo] && !r.prices[mo]!.isActive && r.prices[mo]!.price > 0);
                    const liveOnServer = DURATIONS.every((mo) => r.prices[mo]?.isActive && r.prices[mo]!.price > 0);

                    return (
                      <tr
                        key={k}
                        ref={(el) => { rowRefs.current[k] = el; }}
                        className={cn(
                          "border-b last:border-0",
                          !r.hasContent && "opacity-45",
                          focusKey === k && "bg-wash",
                        )}
                      >
                        <td className="px-4 py-2.5 font-medium text-ink">
                          {r.boardCode} · {r.className}
                          <span className="ml-2 text-[11px] text-text-muted-2">
                            {r.hasContent
                              ? `${plural(r.offeringCount, "offering")} · ${plural(r.testCount, "test")}`
                              : "no offerings"}
                          </span>
                        </td>
                        {DURATIONS.map((mo) => {
                          const cellOff = r.prices[mo] && !r.prices[mo]!.isActive && r.prices[mo]!.price > 0;
                          return (
                            <td key={mo} className="px-2 py-2 align-top">
                              <input
                                value={d[mo]}
                                inputMode="numeric"
                                disabled={!r.hasContent || busy}
                                aria-label={`${r.boardCode} ${r.className} — ${mo} month price`}
                                aria-invalid={cellError(d[mo]) || undefined}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, [k]: { ...prev[k], [mo]: e.target.value.replace(/[^\d]/g, "") } }))
                                }
                                placeholder="—"
                                className={cn(
                                  "h-9 w-20 rounded-[8px] border bg-card px-2 text-sm outline-none focus:border-primary",
                                  r.hasContent && (!d[mo] || cellError(d[mo])) && "border-[color:var(--error)]",
                                )}
                              />
                              {cellOff && (
                                <span className="mt-0.5 block text-[10px] font-medium text-[color:var(--warning)]">
                                  off
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2">
                          {!r.hasContent ? (
                            <span className="text-[11px] text-text-muted-2">nothing to sell yet</span>
                          ) : invalid ? (
                            <Badge variant="secondary" className="bg-error-tint text-[color:var(--error)]">Invalid</Badge>
                          ) : dirty ? (
                            <Badge variant="warning">Unsaved</Badge>
                          ) : pricedButOff ? (
                            <Badge variant="warning" title="Priced but not active — Save to switch it on">Priced · off</Badge>
                          ) : liveOnServer ? (
                            <Badge variant="success">Live</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-error-tint text-[color:var(--error)]">Blocked</Badge>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" disabled={!r.hasContent} onClick={() => setPreviewKey(k)} title="Preview paywall">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={!r.hasContent || busy} onClick={() => fillAcross(r)} title="Fill 6 & 12 from the 3-month price">
                            <Wand2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={!r.hasContent || busy} onClick={() => setCopyFrom(r)} title="Apply this row to every class in this board">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {/* Saveable whenever there is a valid change — including
                              clearing a term, which deactivates it rather than
                              leaving the row stuck at its old price. */}
                          <Button size="sm" variant="outline" disabled={!r.hasContent || busy || invalid || !dirty} onClick={() => saveRow(r)}>
                            {busyKey === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live paywall preview (mini 3c) */}
          <div className="sticky top-20 rounded-2xl border bg-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted-2 mb-3">Student paywall preview</p>
            {preview && previewDraft ? (
              <div className="rounded-[16px] border p-4">
                <p className="font-display text-[16px] font-bold text-ink">Unlock {preview.boardCode} · {preview.className}</p>
                <div className="mt-3 space-y-2">
                  {DURATIONS.map((mo) => {
                    const price = Number(previewDraft[mo]) || 0;
                    const three = Number(previewDraft[3]) || 0;
                    const save = three && mo > 3 && price ? Math.round((1 - price / mo / (three / 3)) * 100) : 0;
                    return (
                      <div key={mo} className={cn(
                        "flex items-center justify-between rounded-[10px] border px-3 py-2 text-sm",
                        mo === 12 && "border-2 border-primary bg-wash",
                      )}>
                        <span>
                          <span className="font-semibold text-ink">{mo} months</span>
                          {price > 0 && <span className="block text-[10px] text-text-muted-2">₹{Math.round(price / mo)}/month</span>}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {save > 0 && <span className="rounded-full bg-success-tint px-1.5 text-[9px] font-bold text-[color:var(--success)]">-{save}%</span>}
                          <span className="font-display font-bold text-ink">{price ? `₹${price}` : "—"}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 h-10 rounded-[10px] bg-primary text-center text-sm font-bold leading-10 text-primary-foreground">
                  Pay ₹{previewDraft[12] || "—"}
                </div>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Pick a row (👁) to preview what students see.</p>
            )}
          </div>
        </div>
      )}

      {/* Copy-to-all confirm, with the count of rows it will overwrite */}
      <Dialog open={copyFrom != null} onOpenChange={(o) => !o && setCopyFrom(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Price {plural(copyTargets.length + 1, "row")} in {copyFrom?.boardCode}
            </DialogTitle>
            <DialogDescription>
              {copyFrom && draft[keyOf(copyFrom)] ? (
                <>
                  ₹{draft[keyOf(copyFrom)][3] || "—"} / ₹{draft[keyOf(copyFrom)][6] || "—"} / ₹{draft[keyOf(copyFrom)][12] || "—"}
                  {" "}goes to {copyFrom.className} and {copyTargets.length} other{" "}
                  {copyTargets.length === 1 ? "class" : "classes"} with offerings.
                  Existing prices in those rows are overwritten — you can undo straight after.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyFrom(null)}>Cancel</Button>
            <Button
              disabled={!copyFrom || !draft[keyOf(copyFrom)] || !hasAnyPrice(draft[keyOf(copyFrom)]) || DURATIONS.some((d) => cellError(draft[keyOf(copyFrom)][d]))}
              onClick={runCopy}
            >
              Apply to {plural(copyTargets.length + 1, "row")} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Undo toast */}
      {toast && (
        <div
          role="status"
          className={cn(
            "fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-[12px] px-4 py-3 text-sm text-white shadow-lift",
            toast.tone === "error" ? "bg-[color:var(--error)]" : "bg-ink",
          )}
        >
          {toast.msg}
          {toast.undo && (
            <button
              onClick={() => { const u = toast.undo!; setToast(null); u(); }}
              className="font-bold text-[color:#A790EA] hover:underline"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Multiplier box for the fill-across shortcut — decimals allowed (×3.6). */
function MultInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      inputMode="decimal"
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
      className="h-8 w-14 rounded-[8px] border bg-card px-2 text-center text-sm outline-none focus:border-primary"
    />
  );
}
