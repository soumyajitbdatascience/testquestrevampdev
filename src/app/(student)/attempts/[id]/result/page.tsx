"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { SecondaryBar } from "@/components/student/student-shell";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { Button } from "@/components/ui/button";
import {
  Trophy, CheckCircle2, XCircle, MinusCircle, ChevronLeft, Lock, Loader2, AlertCircle, ArrowRight, Sparkles,
} from "lucide-react";
import { cn, friendlyAuthError } from "@/lib/utils";
import { RichText } from "@/components/rich-text";
import { Paywall } from "@/components/student/paywall";

interface QuestionResult {
  index: number;
  id: number;
  type: string;
  text: string;
  marks: number;
  chapter: { id: number; name: string };
  isCorrect: boolean;
  marksAwarded: number;
  skipped: boolean;
  studentAnswer: { selectedOptionId: number | null; selectedOption: { id: number; label: string; text: string } | null; fillAnswer: string | null };
  correctAnswer?: { options: { id: number; label: string; text: string }[]; correctText: string | null };
  explanation?: string | null;
  allOptions?: { id: number; label: string; text: string; isCorrect: boolean }[];
  solutionLocked?: boolean;
}

interface Result {
  id: number;
  test: { id: number; name: string; durationMinutes: number; totalMarks: number; isFree: boolean };
  status: string;
  score: number;
  totalMarks: number;
  percentage: string | number;
  timeSpentSeconds: number;
  finishedAt: string;
  summary: { total: number; correct: number; incorrect: number; skipped: number };
  showSolutions: boolean;
  solutionsLocked?: boolean;
  upsell?: { boardId: number; classId: number; minPrice: number | null } | null;
  questions: QuestionResult[];
}

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSolutions, setShowSolutions] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/attempts/${id}/result`).then((r) => r.json()).then((d) => {
      if (d.ok) setResult(d.data);
      else setError(friendlyAuthError(d.error, "Could not load this result"));
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-6 font-display text-3xl">{error || "Result not found"}</h2>
        <Button asChild className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
          <Link href="/dashboard">Back to home <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    );
  }

  const pct = Number(result.percentage);
  const { grade } = getGrade(pct);

  function formatTime(sec: number): string { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}m ${s}s`; }

  return (
    <>
      <SecondaryBar backHref="/dashboard" backLabel="Back to home" title={result.test.name} subtitle="Result" />

      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border bg-surface p-8 md:p-12 mb-8 shadow-soft">
          <div className="absolute top-[-100px] right-[-60px] w-[400px] h-[400px] pointer-events-none bg-glow-gold animate-glow" />
          <div className="absolute bottom-[-80px] left-[-40px] w-[320px] h-[320px] pointer-events-none bg-glow-teal" />

          <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-dim text-primary px-3 py-1 text-xs">
                <Trophy className="h-3.5 w-3.5" /><span>Test complete</span>
              </div>
              <h1 className="mt-5 font-display text-3xl md:text-4xl leading-tight">{result.test.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Finished {new Date(result.finishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>

              <div className="mt-8 flex items-end gap-6 flex-wrap">
                {result.solutionsLocked ? (
                  <div className="flex items-center gap-5">
                    <ScoreRing pct={pct} />
                    <div>
                      <p className="font-display text-2xl font-bold">{grade}</p>
                      <p className="text-sm text-muted-foreground">{result.summary.correct} of {result.summary.total} correct</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="font-display text-7xl md:text-8xl text-primary leading-none">
                      {pct}<span className="text-3xl text-muted-foreground">%</span>
                    </p>
                    <p className="mt-2 inline-block font-display italic text-2xl text-foreground">{grade}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-1 gap-3 md:gap-0 md:divide-y divide-border md:border md:rounded-2xl md:p-2 md:min-w-[200px]">
              <HeroStat label="Score" value={`${result.score} / ${result.totalMarks}`} />
              <HeroStat label="Correct" value={`${result.summary.correct} / ${result.summary.total}`} />
              <HeroStat label="Time" value={formatTime(result.timeSpentSeconds)} />
            </div>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <SummaryTile icon={<CheckCircle2 className="h-5 w-5" />} value={result.summary.correct} label="Correct" color="strong" />
          <SummaryTile icon={<XCircle className="h-5 w-5" />} value={result.summary.incorrect} label="Incorrect" color="needs-work" />
          <SummaryTile icon={<MinusCircle className="h-5 w-5" />} value={result.summary.skipped} label="Skipped" color="muted" />
        </div>

        {/* Solutions */}
        <div className="rounded-2xl border bg-surface overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b flex-wrap gap-3">
            <div>
              <h2 className="font-display text-2xl">Question-by-question review</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {result.showSolutions ? "See your answers, correct ones, and explanations" : "Your answers are shown — step-by-step solutions are in the class pass"}
              </p>
            </div>
            {result.showSolutions && (
              <Button variant="outline" size="sm" onClick={() => setShowSolutions((s) => !s)}>
                {showSolutions ? "Hide" : "Show"} solutions
              </Button>
            )}
          </div>

          <div className="divide-y">
            {result.questions.map((q) => (
              <QuestionReview
                key={q.id}
                question={q}
                showSolution={result.solutionsLocked ? true : (result.showSolutions && showSolutions)}
                onUnlock={() => setPaywallOpen(true)}
              />
            ))}
          </div>
        </div>

        {/* 3b — the conversion moment */}
        {result.solutionsLocked && result.upsell && (
          <div className="mt-8 rounded-2xl border-2 border-primary bg-wash p-6 text-center">
            <p className="font-display text-xl font-bold text-ink">
              Solutions for all {result.summary.total} questions — plus every other test and video in the pass.
            </p>
            <Button
              onClick={() => setPaywallOpen(true)}
              className="mt-4 h-12 bg-primary px-6 text-base font-bold text-primary-foreground hover:bg-primary/90 shadow-[0_6px_18px_rgba(97,52,235,.35)]"
            >
              See where you went wrong{result.upsell.minPrice != null && <> — from ₹{result.upsell.minPrice}</>}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Button asChild variant="outline"><Link href={`/tests/${result.test.id}`}>Retake test</Link></Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
            <Link href="/dashboard">More tests <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <PoweredByTestquest />
      </div>

      {result.upsell && (
        <Paywall
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          boardId={result.upsell.boardId}
          classId={result.upsell.classId}
          returnTo={`/attempts/${result.id}/result`}
        />
      )}
    </>
  );
}

function ScoreRing({ pct }: { pct: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct)) / 100 * c;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Score ${pct} percent`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--wash)" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke="var(--primary)" strokeWidth="10"
        strokeLinecap="round" strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="66" textAnchor="middle" className="font-display" fontSize="26" fontWeight="800" fill="var(--ink)">{pct}%</text>
    </svg>
  );
}

function getGrade(pct: number) {
  if (pct >= 90) return { grade: "Excellent" };
  if (pct >= 75) return { grade: "Great work" };
  if (pct >= 60) return { grade: "Good effort" };
  if (pct >= 40) return { grade: "Keep going" };
  return { grade: "Needs review" };
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="md:p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}

function SummaryTile({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: "strong" | "needs-work" | "muted" }) {
  const colorClass = {
    strong: "bg-primary-dim text-[color:var(--score-strong)]",
    "needs-work": "bg-[color:var(--score-needs-work)]/10 text-[color:var(--score-needs-work)]",
    muted: "bg-surface-hi text-muted-foreground",
  }[color];
  return (
    <div className="rounded-2xl border bg-surface p-5 flex items-center gap-4">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", colorClass)}>{icon}</div>
      <div>
        <p className="font-display text-3xl">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function QuestionReview({ question, showSolution, onUnlock }: { question: QuestionResult; showSolution: boolean; onUnlock?: () => void }) {
  const statusEl = question.skipped ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-hi px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <MinusCircle className="h-3 w-3" /> Skipped
    </span>
  ) : question.isCorrect ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--score-strong)]/15 px-2 py-0.5 text-[10px] font-medium text-[color:var(--score-strong)]">
      <CheckCircle2 className="h-3 w-3" /> Correct
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
      <XCircle className="h-3 w-3" /> Incorrect
    </span>
  );

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-muted-foreground">Q{question.index}</span>
          {statusEl}
          <span className="text-xs text-muted-foreground">{question.chapter.name}</span>
        </div>
        <span className="text-xs font-medium">{question.marksAwarded} / {question.marks} {question.marks === 1 ? "mark" : "marks"}</span>
      </div>

      <RichText html={question.text} className="font-medium leading-relaxed mb-4" />

      {showSolution && question.allOptions ? (
        <div className="space-y-1.5 mb-4">
          {question.allOptions.map((opt) => {
            const isSelected = question.studentAnswer.selectedOptionId === opt.id ||
              (question.type === "MULTI_MCQ" && question.studentAnswer.fillAnswer?.split(",").includes(String(opt.id)));
            return (
              <div key={opt.id} className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
                opt.isCorrect && "bg-[color:var(--score-strong)]/10 border-[color:var(--score-strong)]/40",
                isSelected && !opt.isCorrect && "bg-destructive/10 border-destructive/40",
                !opt.isCorrect && !isSelected && "bg-surface-hi"
              )}>
                <span className={cn(
                  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-medium",
                  opt.isCorrect ? "bg-[color:var(--score-strong)] text-background" :
                  isSelected ? "bg-destructive text-destructive-foreground" :
                  "bg-surface text-foreground"
                )}>{opt.label}</span>
                <RichText html={opt.text} className="flex-1" />
                {opt.isCorrect && <CheckCircle2 className="h-4 w-4 text-[color:var(--score-strong)] flex-shrink-0" />}
                {isSelected && !opt.isCorrect && <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      ) : showSolution && question.type === "FILL_IN_BLANK" ? (
        <div className="space-y-2 mb-4">
          <div className="rounded-lg border bg-surface-hi px-3 py-2.5 text-sm">
            <span className="text-xs text-muted-foreground">Your answer </span>
            <span className="font-medium">{question.studentAnswer.fillAnswer || "—"}</span>
          </div>
          <div className="rounded-lg border bg-[color:var(--score-strong)]/10 border-[color:var(--score-strong)]/40 px-3 py-2.5 text-sm">
            <span className="text-xs text-[color:var(--score-strong)]">Correct answer </span>
            <span className="font-medium">{question.correctAnswer?.correctText}</span>
          </div>
        </div>
      ) : !showSolution && question.studentAnswer.selectedOption ? (
        <div className="rounded-lg border bg-surface-hi px-3 py-2.5 text-sm mb-4">
          <span className="text-xs text-muted-foreground">Your answer </span>
          <span className="font-medium">{question.studentAnswer.selectedOption.label}. <RichText html={question.studentAnswer.selectedOption.text} className="inline" /></span>
        </div>
      ) : null}

      {showSolution && question.explanation && (
        question.solutionLocked ? (
          <button onClick={onUnlock} className="relative block w-full overflow-hidden rounded-lg bg-primary-dim border-l-[3px] border-primary px-4 py-3 text-sm text-left">
            <RichText html={question.explanation} className="leading-relaxed blur-[4px] select-none" />
            <span className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] font-bold text-primary">
              <Lock className="h-4 w-4" /> Step-by-step solutions are in the class pass
            </span>
          </button>
        ) : (
          <div className="rounded-lg bg-primary-dim border-l-[3px] border-primary px-4 py-3 text-sm">
            <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1 uppercase tracking-widest">
              <Sparkles className="h-3 w-3" />Explanation
            </p>
            <RichText html={question.explanation} className="leading-relaxed" />
          </div>
        )
      )}
    </div>
  );
}
