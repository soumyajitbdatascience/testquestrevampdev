"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { StudentHeader } from "@/components/student/student-header";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { Button } from "@/components/ui/button";
import {
  Trophy, Clock, CheckCircle2, XCircle, MinusCircle, ChevronLeft, Lock, Loader2, AlertCircle, ArrowRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  questions: QuestionResult[];
}

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSolutions, setShowSolutions] = useState(true);

  useEffect(() => {
    fetch(`/api/attempts/${id}/result`).then((r) => r.json()).then((d) => {
      if (d.ok) setResult(d.data);
      else setError(d.error);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-background"><StudentHeader /><div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div></div>;
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        <StudentHeader />
        <div className="container mx-auto px-6 py-24 text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-6 font-display text-3xl">{error || "Result not found"}</h2>
          <Button asChild className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
            <Link href="/tests">Back to tests <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  const pct = Number(result.percentage);
  const { grade } = getGrade(pct);

  function formatTime(sec: number): string { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}m ${s}s`; }

  return (
    <div className="min-h-screen bg-background">
      <StudentHeader />

      <div className="container mx-auto px-6 lg:px-12 py-10 max-w-5xl">
        <Link href="/tests" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ChevronLeft className="h-3.5 w-3.5" /><span className="ml-1">Back to tests</span>
        </Link>

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
                <div>
                  <p className="font-display text-7xl md:text-8xl text-primary leading-none">
                    {pct}<span className="text-3xl text-muted-foreground">%</span>
                  </p>
                  <p className="mt-2 inline-block font-display italic text-2xl text-foreground">{grade}</p>
                </div>
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
                {result.showSolutions ? "See your answers, correct ones, and explanations" : "Free tests show score only"}
              </p>
            </div>
            {result.showSolutions && (
              <Button variant="outline" size="sm" onClick={() => setShowSolutions((s) => !s)}>
                {showSolutions ? "Hide" : "Show"} solutions
              </Button>
            )}
          </div>

          {!result.showSolutions && (
            <div className="p-10 text-center bg-surface-hi/40 border-b">
              <Lock className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-4 font-display text-2xl">Solutions are a paid feature</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Free tests show your score. Unlock the paid version to see correct answers and step-by-step explanations.
              </p>
              <Button asChild className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
                <Link href={`/tests/${result.test.id}`}>View paid version <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          )}

          <div className="divide-y">
            {result.questions.map((q) => <QuestionReview key={q.id} question={q} showSolution={result.showSolutions && showSolutions} />)}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Button asChild variant="outline"><Link href={`/tests/${result.test.id}`}>Retake test</Link></Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
            <Link href="/tests">More tests <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <PoweredByTestquest />
      </div>
    </div>
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

function QuestionReview({ question, showSolution }: { question: QuestionResult; showSolution: boolean }) {
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

      <p className="font-medium leading-relaxed mb-4">{question.text}</p>

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
                <span className="flex-1">{opt.text}</span>
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
          <span className="font-medium">{question.studentAnswer.selectedOption.label}. {question.studentAnswer.selectedOption.text}</span>
        </div>
      ) : null}

      {showSolution && question.explanation && (
        <div className="rounded-lg bg-primary-dim border-l-[3px] border-primary px-4 py-3 text-sm">
          <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1 uppercase tracking-widest">
            <Sparkles className="h-3 w-3" />Explanation
          </p>
          <p className="leading-relaxed">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
