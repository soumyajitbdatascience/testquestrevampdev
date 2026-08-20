"use client";

import { useEffect, useState, useRef, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StudentShell, SecondaryBar } from "@/components/student/student-shell";
import { Paywall } from "@/components/student/paywall";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { friendlyAuthError } from "@/lib/utils";
import {
  Clock,
  FileText,
  Target,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Lock,
  Shuffle,
  Sparkles,
  Calendar,
  ArrowRight,
  Trophy,
} from "lucide-react";

interface TestDetail {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  totalMarks: number;
  /**
  * `isFree` and `price` used to sit here. Neither is returned by
  * `/api/tests/[id]` any more — per-test purchase is retired, access comes
  * from a class pass — so both read `undefined` at runtime. `isFreeSample` is
  * the field the API actually sends.
  */
  isFreeSample: boolean;
  isPractice: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  retakeCooldownDays: number;
  questionCount: number;
  hasAccess: boolean;
  attemptCount: number;
  lastAttempt: { id: number; status: string; score: number | null; percentage: string | number | null; startedAt: string; finishedAt: string | null } | null;
  board: { id: number; name: string; code: string } | null;
  class: { id: number; name: string } | null;
  subject: { id: number; name: string } | null;
}

export default function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <TestDetailPageInner params={params} />
    </Suspense>
  );
}

function TestDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = still checking, then true/false
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  // Where to send the guest after they sign in / sign up
  const [authNext, setAuthNext] = useState<string>("");
  const autoStarted = useRef(false);

  useEffect(() => {
    fetch(`/api/tests/${id}`).then((r) => r.json()).then((d) => {
      if (d.ok) setTest(d.data);
      else setError(d.error || "Test not found");
    }).finally(() => setLoading(false));
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setIsAuthed(!!d.ok)).catch(() => setIsAuthed(false));
  }, [id]);

  async function startAttempt() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId: Number(id) }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.error === "Unauthorized") { openAuthPrompt(`/tests/${id}?start=1`); return; }
        setError(friendlyAuthError(data.error, "Could not start the test"));
        return;
      }
      router.push(`/attempts/${data.data.attemptId}`);
    } finally {
      setActionLoading(false);
    }
  }

  function openAuthPrompt(next: string) {
    setAuthNext(next);
    setAuthPromptOpen(true);
  }

  function handleStartClick() {
    if (isAuthed === false) { openAuthPrompt(`/tests/${id}?start=1`); return; }
    startAttempt();
  }

  // Unlocking a locked test means buying its **class pass** — there is no
  // per-test product any more. The old handler pushed
  // /checkout?type=TEST&id=…, a route for an item type that no longer prices.
  // Guests still sign in first; the prompt returns them here.
  function handleUnlockClick() {
    if (isAuthed === false) { openAuthPrompt(`/tests/${id}`); return; }
    setPaywallOpen(true);
  }

  // After returning from login/signup with ?start=1: begin the test automatically.
  const wantsAutoStart = searchParams.get("start") === "1";
  const canStartNow = !!test && (test.hasAccess || test.isFreeSample);
  useEffect(() => {
    if (wantsAutoStart && isAuthed && canStartNow && !autoStarted.current) {
      autoStarted.current = true;
      startAttempt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAutoStart, isAuthed, canStartNow]);

  if (loading) {
    return (
      <StudentShell>
        <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      </StudentShell>
    );
  }

  if (!test) {
    return (
      <StudentShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-6 font-display text-3xl">{error || "Test not found"}</h2>
          <Button asChild className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
            <Link href="/dashboard">Back to home <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </StudentShell>
    );
  }

  const canStart = test.hasAccess || test.isFreeSample;
  const hasInProgress = test.lastAttempt?.status === "IN_PROGRESS" || test.lastAttempt?.status === "PAUSED";

  return (
    <StudentShell>
      <SecondaryBar
        backHref={test.subject ? `/offerings/${test.subject.id}` : "/dashboard"}
        title={test.name}
        subtitle={<>{test.class?.name ?? "Uncategorized"}{test.subject?.name && <> · {test.subject.name}</>}</>}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">

        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <span>{test.class?.name ?? "Uncategorized"}</span>
                {test.subject?.name && (<><span>·</span><span>{test.subject.name}</span></>)}
                {test.isPractice && (<><span>·</span><span className="inline-flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" />Practice mode</span></>)}
              </div>
              <h1 className="font-display text-4xl md:text-5xl leading-tight text-balance">{test.name}</h1>
              {test.description && (
                <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">{test.description}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-px rounded-2xl border bg-border overflow-hidden">
              <StatBox icon={<FileText className="h-4 w-4" />} value={test.questionCount} label="Questions" />
              <StatBox icon={<Clock className="h-4 w-4" />} value={test.isPractice ? "Untimed" : `${test.durationMinutes} min`} label="Duration" />
              <StatBox icon={<Target className="h-4 w-4" />} value={test.totalMarks} label="Total marks" />
            </div>

            {/* Instructions */}
            <div className="rounded-2xl border bg-surface p-6">
              <h2 className="font-display text-2xl mb-4">Before you start</h2>
              <ul className="space-y-3">
                {test.isPractice ? (
                  <Instruction icon={<Sparkles className="h-4 w-4" />} text="Practice mode — take your time. Get instant feedback after each question." />
                ) : (
                  <Instruction
                    icon={<Clock className="h-4 w-4" />}
                    text={<>You have <strong className="text-foreground">{test.durationMinutes} minutes</strong> to complete the test. The timer starts when you begin.</>}
                  />
                )}
                {test.randomizeQuestions && (
                  <Instruction icon={<Shuffle className="h-4 w-4" />} text="Questions appear in a random order, unique to your attempt." />
                )}
                <Instruction icon={<CheckCircle2 className="h-4 w-4" />} text="Flag questions for review and navigate freely between them." />
                {!test.isPractice && (
                  <Instruction icon={<AlertCircle className="h-4 w-4 text-[color:var(--score-on-track)]" />} text="The test auto-submits when time runs out — your answers are saved continuously." />
                )}
                {!test.isFreeSample && (
                  <Instruction icon={<CheckCircle2 className="h-4 w-4" />} text="Detailed solutions and explanations are shown after submission." />
                )}
                {test.retakeCooldownDays > 0 && (
                  <Instruction icon={<Calendar className="h-4 w-4" />} text={`Retake available after ${test.retakeCooldownDays} day(s) from your last attempt.`} />
                )}
              </ul>
            </div>

            {test.lastAttempt && test.lastAttempt.percentage !== null && (
              <div className="rounded-2xl border bg-surface p-6 flex items-center gap-5">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-gold">
                  <Trophy className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Your last attempt</p>
                  <p className="mt-1 font-display text-3xl">{test.lastAttempt.percentage}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Scored {test.lastAttempt.score} of {test.totalMarks} marks
                    {test.attemptCount > 1 && ` · ${test.attemptCount} attempts so far`}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/attempts/${test.lastAttempt.id}/result`}>View result <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            )}
          </div>

          {/* Sticky action */}
          <aside className="md:col-span-1">
            <div className="md:sticky md:top-24 rounded-2xl border bg-surface shadow-soft p-6">
              {canStart ? (
                <>
                  <div className="text-center pb-5 border-b mb-5">
                    {test.isFreeSample ? (
                      <p className="font-display text-3xl text-[color:var(--score-strong)]">Free sample</p>
                    ) : (
                      <p className="font-display text-3xl">Access granted</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {test.isFreeSample ? "No purchase required" : "Included in your class pass"}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>
                  )}

                  {hasInProgress ? (
                    <Button onClick={() => router.push(`/attempts/${test.lastAttempt!.id}`)} className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold" size="lg">
                      <RotateCcw className="h-4 w-4" /> Resume attempt
                    </Button>
                  ) : (
                    <Button onClick={handleStartClick} className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold animate-pulse-gold" size="lg" disabled={actionLoading}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>{test.lastAttempt ? "Retake test" : "Start test"} <ArrowRight className="h-4 w-4" /></>)}
                    </Button>
                  )}

                  <p className="mt-3 text-center text-xs text-muted-foreground">Stable connection recommended</p>
                </>
              ) : (
                <>
                  {/* No price here any more. There is no per-test price to
                      show — the figure came from a `price` field the API
                      stopped sending, so this rendered a bare "₹". The paywall
                      itself is where the class pass and its durations are
                      priced, and it is the only place that knows them. */}
                  <div className="text-center pb-5 border-b mb-5">
                    <p className="font-display text-2xl">
                      Part of the {test.class?.name ?? "class"} pass
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      One pass unlocks every subject in {test.class?.name ?? "this class"}
                    </p>
                  </div>

                  <Button onClick={handleUnlockClick} className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold" size="lg">
                    <Lock className="h-4 w-4" /> Unlock test
                  </Button>

                  {/* Perks describe the class pass, not the retired per-test
                      product: a pass runs for a fixed term, so the old
                      "Lifetime access — no expiry" line was untrue here. */}
                  <ul className="mt-5 space-y-2.5 text-sm">
                    <PerkLine text="Every subject in this class" />
                    <PerkLine text="Detailed step-by-step solutions" />
                    <PerkLine text="Unlimited retakes while your pass is active" />
                    <PerkLine text="One-time payment · no auto-renewal" />
                  </ul>
                </>
              )}
            </div>
          </aside>
        </div>
        <PoweredByTestquest />
      </div>

      {/* Guest auth prompt — sign in / create account, then continue automatically */}
      <Dialog open={authPromptOpen} onOpenChange={setAuthPromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {canStart ? "Sign in to start this test" : "Sign in to unlock this test"}
            </DialogTitle>
            <DialogDescription>
              It takes less than a minute — and it&apos;s free to join.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => router.push(`/signup?next=${encodeURIComponent(authNext)}`)}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold"
            >
              Create free account <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/login?next=${encodeURIComponent(authNext)}`)}
              className="w-full h-11"
            >
              I already have an account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Class paywall — scoped to this test's own board+class, so buying from
          here grants the pass that actually covers the paper being looked at. */}
      {test.board && test.class && (
        <Paywall
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          boardId={test.board.id}
          classId={test.class.id}
          returnTo={`/tests/${id}`}
        />
      )}
    </StudentShell>
  );
}

function StatBox({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="bg-surface p-5 text-center">
      <div className="flex justify-center text-muted-foreground mb-2">{icon}</div>
      <p className="font-display text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function Instruction({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary-dim text-primary mt-0.5">{icon}</span>
      <span className="pt-1">{text}</span>
    </li>
  );
}

function PerkLine({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 text-[color:var(--score-strong)] flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
}
