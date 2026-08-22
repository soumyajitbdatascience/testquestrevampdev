"use client";

/**
 * Add a class (handoff 2a) — one sheet, two taps: pick a class, confirm with
 * the CTA. Bottom sheet on mobile, centred ~420px modal on desktop.
 *
 * It supersedes the three-step `/onboarding?add=1` page. An add is not
 * onboarding: the student already has a board, so defaulting it to a chip row
 * removes a whole step, and a separate confirm screen would only restate what
 * the picker already showed. The sheet never navigates — closing it returns
 * the student to exactly where they were.
 *
 * Guarantees carried over from the three-step version: a class they already
 * hold is disabled rather than hidden (and reads "Already added", never an
 * error), boards with no content are never listed, and adding lands quietly on
 * the new class's Home with no toast or celebration.
 *
 * Scope, not entitlement: adding a context grants nothing. What may be opened
 * is still decided by `hasClassAccess` alone.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BoardOption { id: number; name: string; code: string }
interface ClassOption { id: number; name: string; offeringCount: number }
interface ClassSummary {
  /** Which class these counts describe — a summary for any other is ignored. */
  classId: number;
  boardName: string;
  className: string;
  counts: { subjects: number; tests: number; videos: number };
  freeSampleCount: number;
  minPrice: number | null;
}

/**
 * Mounted only while open (the shell renders it conditionally), so every open
 * is a fresh mount. That is deliberate: it means "reset the pick when the
 * sheet reopens" needs no effect — a stale class from a sheet dismissed
 * minutes ago simply cannot survive to be confirmed by a CTA the student
 * never aimed at.
 */
export function AddClassSheet({
  onClose,
  currentBoardId,
  heldPairs,
  onAdded,
}: {
  onClose: () => void;
  /** Pre-selected chip — the board the student is already studying on. */
  currentBoardId: number;
  /** Every board+class the student holds, for the "Already added" state. */
  heldPairs: Array<{ boardId: number; classId: number }>;
  onAdded: () => void;
}) {
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [boardId, setBoardId] = useState<number>(currentBoardId);
  // Cached per board so flipping back never refetches or flashes.
  const [classesByBoard, setClassesByBoard] = useState<Record<number, ClassOption[]>>({});
  const [classId, setClassId] = useState<number | null>(null);
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classError, setClassError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    fetch("/api/boards?withClasses=1")
      .then((r) => r.json())
      .then((d) => d.ok && setBoards(d.data))
      .catch(() => {});
  }, []);

  const loadClasses = useCallback((id: number) => {
    fetch(`/api/boards/${id}/classes`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error);
        setClassesByBoard((prev) => ({ ...prev, [id]: d.data }));
        // Cleared on success rather than before the request: an error should
        // stand until something actually replaces it.
        setClassError(null);
      })
      // Naming the fix beats a bare "error" — the student can act on this one.
      .catch(() => setClassError("Couldn't load classes for this board."));
  }, []);

  useEffect(() => {
    if (classesByBoard[boardId] !== undefined) return;
    loadClasses(boardId);
  }, [boardId, classesByBoard, loadClasses]);

  // Escape closes, like any dismissible surface.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The summary strip's counts are real, fetched for the exact board+class
  // picked — never the active context's, and never a hardcoded figure.
  useEffect(() => {
    if (classId == null) return;
    let cancelled = false;
    fetch(`/api/plans?boardId=${boardId}&classId=${classId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const prices = (d.data.plans as Array<{ price: number }>).map((p) => Number(p.price));
        setSummary({
          classId,
          boardName: d.data.boardName,
          className: d.data.className,
          counts: d.data.counts,
          freeSampleCount: d.data.freeSampleCount ?? 0,
          minPrice: prices.length ? Math.min(...prices) : null,
        });
      })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [boardId, classId]);

  // Only a summary for the class currently picked may be shown; anything left
  // over from a previous pick is simply not rendered.
  const shownSummary = summary && summary.classId === classId ? summary : null;
  const classes = classesByBoard[boardId] ?? [];
  const loadingClasses = classesByBoard[boardId] === undefined && !classError;
  const held = new Set(heldPairs.filter((h) => h.boardId === boardId).map((h) => h.classId));
  const picked = classes.find((c) => c.id === classId) ?? null;

  async function add() {
    if (!classId) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/student/contexts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, classId, isPrimary: false }),
      }).then((r) => r.json());
      if (!res.ok) { setError(res.error || "Could not add that class"); setSaving(false); return; }

      // Switch to it before landing — otherwise the student arrives back on
      // whichever class they were already viewing, which reads as a bug.
      await fetch("/api/student/contexts/active", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId: res.data.id }),
      });
      fetch("/api/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "class_added", properties: { boardId, classId } }),
      }).catch(() => {});
      onAdded();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  // Honest CTA: "try n free tests" only when there are n to try. Not every
  // offering carries a free sample, so deriving n from the subject count would
  // promise papers that aren't there.
  const freeCount = shownSummary?.freeSampleCount ?? 0;
  const ctaLabel = !picked
    ? "Pick a class"
    : freeCount > 0
      ? `Add ${picked.name} · try ${freeCount} free test${freeCount === 1 ? "" : "s"}`
      : `Add ${picked.name}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Add a class">
      <div
        className="absolute inset-0 bg-[oklch(0.205_0.089_282.7_/_0.55)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        onClick={onClose}
      />

      <div
        className={cn(
          "relative w-full rounded-t-[20px] bg-card px-5 pb-5 pt-2.5",
          "sm:max-w-[420px] sm:rounded-[18px] sm:p-6",
          "shadow-[0_24px_64px_oklch(0.205_0.089_282.7_/_0.35)]",
          "motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200 motion-safe:ease-out",
        )}
      >
        {/* Grabber — mobile affordance only. */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink">Add a class</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-wash"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        </div>

        {/* Board chips — current board pre-selected, switching is optional. */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          {boards.map((b) => {
            const on = b.id === boardId;
            return (
              <button
                key={b.id}
                onClick={() => { setBoardId(b.id); setClassId(null); }}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-9 items-center gap-[5px] rounded-full px-3.5 text-[12.5px] font-bold transition-colors",
                  on ? "bg-primary text-primary-foreground" : "bg-wash text-text-secondary hover:text-ink",
                )}
              >
                {on && <Check className="h-[11px] w-[11px]" strokeWidth={3} />}
                {b.name}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 px-0.5 text-[10.5px] font-semibold text-text-secondary">
          Your current board is pre-selected — tap another to switch
        </p>

        {/* Class grid */}
        <div className="mt-3.5 grid grid-cols-3 gap-2.5">
          {classes.map((c) => {
            const alreadyAdded = held.has(c.id);
            const selected = c.id === classId;
            return (
              <button
                key={c.id}
                onClick={() => setClassId(c.id)}
                disabled={alreadyAdded}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-[14px] px-2 text-center transition-colors",
                  alreadyAdded
                    ? "cursor-not-allowed border border-border bg-wash/75"
                    : selected
                      ? "border-2 border-primary bg-wash"
                      : "border border-border bg-card hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "text-sm",
                    alreadyAdded ? "font-bold text-text-secondary" : selected ? "font-extrabold text-ink" : "font-bold text-ink",
                  )}
                >
                  {c.name}
                </span>
                {alreadyAdded ? (
                  <span className="flex items-center gap-[3px] text-[10px] font-bold text-success">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} /> Already added
                  </span>
                ) : (
                  // Honest up front — better than landing on an empty home.
                  c.offeringCount === 0 && (
                    <span className="text-[10px] font-medium text-text-secondary">coming soon</span>
                  )
                )}
              </button>
            );
          })}

          {classes.length === 0 && (
            <div className="col-span-3 py-6 text-center">
              {loadingClasses ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-text-secondary" />
              ) : classError ? (
                <>
                  <p className="text-[13px] font-semibold text-error">{classError}</p>
                  <button
                    onClick={() => loadClasses(boardId)}
                    className="mt-2 min-h-[44px] px-3 text-[13px] font-bold text-primary-deep"
                  >
                    Try again
                  </button>
                </>
              ) : (
                <p className="text-[13px] text-text-secondary">No classes listed for this board yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Summary strip — appears on pick, real counts for the picked class. */}
        {picked && shownSummary && (
          <div className="mt-3.5 flex items-start gap-2 rounded-[12px] border bg-bg-alt px-3 py-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <Sparkles className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <span className="text-[11.5px] font-semibold leading-[1.45] text-text-secondary">
              <strong className="text-ink">
                {boards.find((b) => b.id === boardId)?.code || shownSummary.boardName} · {shownSummary.className}
              </strong>
              {" — "}
              {shownSummary.counts.subjects} subject{shownSummary.counts.subjects === 1 ? "" : "s"} · {shownSummary.counts.tests} test
              {shownSummary.counts.tests === 1 ? "" : "s"}
              {freeCount > 0 && (
                <> · <strong className="text-ink">{freeCount} free test{freeCount === 1 ? "" : "s"} to try</strong></>
              )}
            </span>
          </div>
        )}

        {error && <p className="mt-3 text-[13px] font-semibold text-error">{error}</p>}

        {/* The CTA is the confirm — there is no third screen. */}
        <button
          onClick={add}
          disabled={!picked || saving}
          data-testid="add-class-confirm"
          className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary text-[14.5px] font-bold text-primary-foreground shadow-[0_6px_18px_oklch(0.508_0.251_284.3_/_0.35)] transition-opacity disabled:opacity-50 disabled:shadow-none"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" strokeWidth={2.5} />{ctaLabel}</>}
        </button>

        <p className="mt-2 text-center text-[10.5px] font-semibold text-text-secondary">
          Switches you right away — flip back anytime · its pass is separate
          {shownSummary?.minPrice != null && <>, from ₹{shownSummary.minPrice}</>}
        </p>
      </div>
    </div>
  );
}
