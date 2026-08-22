"use client";

/**
 * Two flows on one screen, both shell-less by design.
 *
 * **Onboarding** (default): three ~20s steps — board → class → optional second
 * class. Reached only when the student has zero contexts; the `(student)`
 * layout is what sends them here, and it never does so twice because one
 * `tq_student_contexts` row is enough forever.
 *
 * **Add a class** (`?add=1`): the same picker, scoped to one addition, entered
 * from the header's context switcher. It deliberately skips the
 * "already onboarded → go home" bounce below, which is what made the switcher's
 * ＋ row a no-op. Classes the student already holds are disabled rather than
 * hidden, so it is obvious why they can't be picked.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";

interface BoardOption { id: number; name: string; code: string }
interface ClassOption { id: number; name: string; offeringCount: number }

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 board · 1 class · 2 optional second class
  const [boards, setBoards] = useState<BoardOption[]>([]);
  // Keyed by board so switching boards can never flash the previous board's
  // classes, and picking one again doesn't refetch.
  const [classesByBoard, setClassesByBoard] = useState<Record<number, ClassOption[]>>({});
  const [boardId, setBoardId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [secondClassId, setSecondClassId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only boards that actually run classes — picking one that leads to an
    // empty class list is a dead end, and onboarding must not have those.
    fetch("/api/boards?withClasses=1").then((r) => r.json()).then((d) => d.ok && setBoards(d.data));
    // Onboarding writes contexts, which needs a session — send a signed-out
    // visitor to log in rather than letting them fill in three steps and hit
    // a 401 at the end.
    fetch("/api/auth/me").then((r) => {
      if (r.status === 401) router.replace("/login?next=/onboarding");
    });
    // Already onboarded? Straight to home — this screen is first-run only.
    fetch("/api/student/contexts").then((r) => r.json()).then((d) => {
      if (d.ok && d.data.length > 0) router.replace("/dashboard");
    });
  }, [router]);

  // Classes come from the chosen board: offering every class regardless of
  // board let a student pick a combination that doesn't exist.
  useEffect(() => {
    if (boardId == null) return;
    fetch(`/api/boards/${boardId}/classes`)
      .then((r) => r.json())
      .then((d) => d.ok && setClassesByBoard((prev) => ({ ...prev, [boardId]: d.data })));
  }, [boardId]);

  const classes = boardId != null ? classesByBoard[boardId] ?? [] : [];
  const loadingClasses = boardId != null && classesByBoard[boardId] === undefined;

  async function finish(withSecondClass: boolean) {
    if (!boardId || !classId) return;
    const second = withSecondClass ? secondClassId : null;
    setSaving(true); setError(null);
    try {
      const post = (cid: number, isPrimary: boolean) =>
        fetch("/api/student/contexts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, classId: cid, isPrimary }),
        }).then((r) => r.json());
      const first = await post(classId, true);
      if (!first.ok) { setError(first.error || "Could not save"); setSaving(false); return; }
      if (second && second !== classId) await post(second, false);
      fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "onboarding_completed", properties: { boardId, classId, secondClassId: second } }) }).catch(() => {});
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  const steps = ["Board", "Class", "One more?"];

  return (
    <div className="min-h-screen bg-wash flex flex-col items-center px-5 py-8 sm:justify-center">
      <div className="w-full sm:max-w-[520px] sm:rounded-[18px] sm:border sm:bg-card sm:p-8 sm:shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark className="h-8 w-8" />
          <span className="font-bold tracking-tight text-ink">Test<span className="text-primary">Quest</span></span>
        </div>

        <div className="flex gap-1.5 mb-8" role="progressbar" aria-valuenow={step + 1} aria-valuemax={steps.length}>
          {steps.map((_, i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 className="font-display text-2xl font-bold text-ink">Which board are you on?</h1>
            <p className="mt-1 text-sm text-text-secondary">We&apos;ll show you tests made for your syllabus.</p>
            <div className="mt-6 space-y-2.5">
              {boards.map((b) => {
                const active = b.id === boardId;
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      // Class ids are board-specific — a stale pick would bind
                      // the student to a combination this board doesn't run.
                      setBoardId(b.id);
                      setClassId(null);
                      setSecondClassId(null);
                    }}
                    className={cn(
                      "flex h-[52px] w-full items-center justify-between rounded-[14px] border px-4 text-left text-[15px] font-semibold transition-colors",
                      active ? "border-2 border-primary bg-wash text-ink" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {b.name}
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", active ? "bg-primary text-primary-foreground" : "border border-border")}>
                      {active && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStep(1)}
              disabled={!boardId}
              className="mt-8 h-12 w-full rounded-[14px] bg-primary font-bold text-primary-foreground shadow-[0_6px_18px_rgba(97,52,235,.35)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-display text-2xl font-bold text-ink">Which class are you in?</h1>
            <p className="mt-1 text-sm text-text-secondary">Pick your main class — you can add more later.</p>
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {classes.map((c) => {
                const active = c.id === classId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setClassId(c.id)}
                    className={cn(
                      "flex h-[56px] flex-col items-center justify-center rounded-[14px] border px-2 text-sm font-semibold transition-colors",
                      active ? "border-2 border-primary bg-wash text-ink" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {c.name}
                    {/* Honest up front — better than landing on an empty home. */}
                    {c.offeringCount === 0 && (
                      <span className="text-[10px] font-medium text-text-secondary">coming soon</span>
                    )}
                  </button>
                );
              })}
              {classes.length === 0 && (
                <p className="col-span-3 py-6 text-center text-sm text-text-secondary">
                  {loadingClasses
                    ? "Loading classes…"
                    : "No classes listed for this board yet — go back and pick another."}
                </p>
              )}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!classId}
              className="mt-8 h-12 w-full rounded-[14px] bg-primary font-bold text-primary-foreground shadow-[0_6px_18px_rgba(97,52,235,.35)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-2xl font-bold text-ink">Preparing for another class too?</h1>
            <p className="mt-1 text-sm text-text-secondary">Optional — add a second class if you need it.</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {classes.filter((c) => c.id !== classId).map((c) => {
                const active = c.id === secondClassId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSecondClassId(active ? null : c.id)}
                    className={cn(
                      "h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                      active ? "border-2 border-primary bg-wash text-ink" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-4 text-sm text-error">{error}</p>}
            <div className="mt-8 flex gap-3">
              {/* Skip means skip: a second class picked then skipped isn't saved. */}
              <button onClick={() => finish(false)} disabled={saving} className="h-12 flex-1 rounded-[14px] border font-semibold text-text-secondary disabled:opacity-50">
                Skip
              </button>
              <button
                onClick={() => finish(true)}
                disabled={saving}
                className="h-12 flex-1 rounded-[14px] bg-primary font-bold text-primary-foreground shadow-[0_6px_18px_rgba(97,52,235,.35)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
