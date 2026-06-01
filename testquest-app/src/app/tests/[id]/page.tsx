"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StudentHeader } from "@/components/student/student-header";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { Button } from "@/components/ui/button";
import {
  Clock,
  FileText,
  Target,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
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
  isFree: boolean;
  price: string | number;
  isPractice: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  retakeCooldownDays: number;
  questionCount: number;
  hasAccess: boolean;
  attemptCount: number;
  lastAttempt: { id: number; status: string; score: number | null; percentage: string | number | null; startedAt: string; finishedAt: string | null } | null;
  class: { id: number; name: string } | null;
  subject: { id: number; name: string } | null;
}

export default function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tests/${id}`).then((r) => r.json()).then((d) => {
      if (d.ok) setTest(d.data);
      else setError(d.error || "Test not found");
    }).finally(() => setLoading(false));
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
      if (!data.ok) { setError(data.error || "Could not start the test"); return; }
      router.push(`/attempts/${data.data.attemptId}`);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <StudentHeader />
        <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-background">
        <StudentHeader />
        <div className="container mx-auto px-6 py-24 text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-6 font-display text-3xl">{error || "Test not found"}</h2>
          <Button asChild className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
            <Link href="/tests">Back to tests <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  const canStart = test.hasAccess || test.isFree;
  const hasInProgress = test.lastAttempt?.status === "IN_PROGRESS" || test.lastAttempt?.status === "PAUSED";

  return (
    <div className="min-h-screen bg-background">
      <StudentHeader />

      <div className="container mx-auto px-6 lg:px-12 py-10 max-w-5xl">
        <Link href="/tests" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ChevronLeft className="h-3.5 w-3.5" /><span className="ml-1">Back to tests</span>
        </Link>

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
                {!test.isFree && (
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
                    {test.isFree ? (
                      <p className="font-display text-3xl text-[color:var(--score-strong)]">Free</p>
                    ) : (
                      <p className="font-display text-3xl">Access granted</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {test.isFree ? "No purchase required" : "Lifetime access · Unlimited retakes"}
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
                    <Button onClick={startAttempt} className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold animate-pulse-gold" size="lg" disabled={actionLoading}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>{test.lastAttempt ? "Retake test" : "Start test"} <ArrowRight className="h-4 w-4" /></>)}
                    </Button>
                  )}

                  <p className="mt-3 text-center text-xs text-muted-foreground">Stable connection recommended</p>
                </>
              ) : (
                <>
                  <div className="text-center pb-5 border-b mb-5">
                    <p className="font-display text-5xl">₹{test.price}</p>
                    <p className="text-xs text-muted-foreground mt-2">One-time purchase</p>
                  </div>

                  <Button onClick={() => router.push(`/checkout?type=TEST&id=${test.id}`)} className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold" size="lg">
                    <Lock className="h-4 w-4" /> Unlock test
                  </Button>

                  <ul className="mt-5 space-y-2.5 text-sm">
                    <PerkLine text="Detailed step-by-step solutions" />
                    <PerkLine text="Lifetime access — no expiry" />
                    <PerkLine text="Unlimited retakes" />
                    <PerkLine text="Secure payment via Razorpay" />
                  </ul>
                </>
              )}
            </div>
          </aside>
        </div>
        <PoweredByTestquest />
      </div>
    </div>
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
