"use client";

import { useEffect, useState, useCallback, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LogoMark } from "@/components/brand/logo";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Clock, Flag, ChevronLeft, ChevronRight, CheckCircle2,
  Loader2, AlertCircle, Pause, Send, Sparkles, LayoutGrid,
} from "lucide-react";
import { cn, friendlyAuthError } from "@/lib/utils";
import { RichText } from "@/components/rich-text";

interface QuestionOption { id: number; label: string; text: string }

interface Question {
  index: number;
  id: number;
  type: "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK";
  text: string;
  marks: number;
  options: QuestionOption[];
  selectedOptionId: number | null;
  fillAnswer: string | null;
  isFlagged: boolean;
}

interface Attempt {
  id: number;
  status: string;
  test: { id: number; name: string; durationMinutes: number; isPractice: boolean };
  totalMarks: number;
  remainingSeconds: number | null;
  questions: Question[];
  answeredCount: number;
  flaggedCount: number;
}

type AnswerState = {
  selectedOptionId: number | null;
  selectedOptionIds: number[];
  fillAnswer: string;
  isFlagged: boolean;
};

export default function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPaletteSheet, setShowPaletteSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch(`/api/attempts/${id}`).then((r) => r.json()).then((d) => {
      if (!d.ok) { setError(friendlyAuthError(d.error, "Could not load this attempt")); return; }
      const data: Attempt = d.data;
      setAttempt(data);
      setRemainingSec(data.remainingSeconds);

      const initial: Record<number, AnswerState> = {};
      for (const q of data.questions) {
        const multiIds = q.fillAnswer && q.type === "MULTI_MCQ"
          ? q.fillAnswer.split(",").filter(Boolean).map(Number) : [];
        initial[q.id] = {
          selectedOptionId: q.selectedOptionId,
          selectedOptionIds: multiIds,
          fillAnswer: q.type === "FILL_IN_BLANK" ? (q.fillAnswer || "") : "",
          isFlagged: q.isFlagged,
        };
      }
      setAnswers(initial);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (remainingSec === null || attempt?.test.isPractice) return;
    const interval = setInterval(() => {
      setRemainingSec((s) => {
        if (s === null) return null;
        if (s <= 1) { clearInterval(interval); autoSubmit(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec === null, attempt?.test.isPractice]);

  const saveAnswer = useCallback(async (questionId: number, state: AnswerState) => {
    if (!attempt) return;
    const question = attempt.questions.find((q) => q.id === questionId);
    if (!question) return;
    const body: Record<string, unknown> = { questionId, isFlagged: state.isFlagged };
    if (question.type === "SINGLE_MCQ") body.selectedOptionId = state.selectedOptionId;
    else if (question.type === "MULTI_MCQ") body.selectedOptionIds = state.selectedOptionIds;
    else body.fillAnswer = state.fillAnswer;
    await fetch(`/api/attempts/${id}/answer`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  }, [attempt, id]);

  function updateAnswer(questionId: number, patch: Partial<AnswerState>) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: { ...prev[questionId], ...patch } };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveAnswer(questionId, next[questionId]), 500);
      return next;
    });
  }

  async function autoSubmit() {
    setSubmitting(true);
    await fetch(`/api/attempts/${id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auto: true }) });
    router.push(`/attempts/${id}/result`);
  }

  async function manualSubmit() {
    setSubmitting(true);
    const res = await fetch(`/api/attempts/${id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auto: false }) });
    const data = await res.json();
    if (data.ok) router.push(`/attempts/${id}/result`);
    else { setError(friendlyAuthError(data.error, "Submit failed")); setSubmitting(false); }
  }

  async function pauseAttempt() {
    await fetch(`/api/attempts/${id}/pause`, { method: "POST" });
    router.push("/dashboard");
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !attempt) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-6 font-display text-3xl">{error || "Attempt not found"}</h2>
          <Button onClick={() => router.push("/dashboard")} className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">Back to home</Button>
        </div>
      </div>
    );
  }

  const currentQ = attempt.questions[currentIdx];
  const currentA = answers[currentQ.id];
  const totalQs = attempt.questions.length;
  const answeredIds = new Set(
    Object.entries(answers).filter(([, a]) => a.selectedOptionId !== null || a.selectedOptionIds.length > 0 || a.fillAnswer.trim()).map(([qid]) => Number(qid))
  );

  function formatTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  const timerClasses = remainingSec === null
    ? "bg-surface-hi text-foreground"
    : remainingSec < 60
    ? "bg-destructive text-destructive-foreground animate-pulse"
    : remainingSec < 300
    ? "bg-[color:var(--score-on-track)] text-background"
    : "bg-primary text-primary-foreground";

  const progress = (answeredIds.size / totalQs) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <LogoMark className="h-7 w-7" />
            <span className="font-medium truncate text-sm hidden sm:inline">{attempt.test.name}</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {remainingSec !== null && (
              <div className={cn("flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-sm font-semibold transition-colors", timerClasses)}>
                <Clock className="h-3.5 w-3.5" />
                {formatTime(remainingSec)}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPaletteSheet(true)}
              className="lg:hidden"
              aria-label="Open question palette"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">{answeredIds.size}/{totalQs}</span>
            </Button>
            {!attempt.test.isPractice && (
              <Button variant="outline" size="sm" onClick={pauseAttempt} disabled={submitting}>
                <Pause className="h-3.5 w-3.5" /><span className="hidden sm:inline">Pause</span>
              </Button>
            )}
            <Button size="sm" onClick={() => setShowSubmitModal(true)} disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
              <Send className="h-3.5 w-3.5" />Submit
            </Button>
          </div>
        </div>
        <div className="h-1 bg-surface-hi">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="container mx-auto flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Question */}
          <div className="rounded-2xl border bg-surface p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">Question {currentQ.index} of {totalQs}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium">{currentQ.marks} {currentQ.marks === 1 ? "mark" : "marks"}</span>
                {currentQ.type === "MULTI_MCQ" && (<><span className="text-muted-foreground">·</span><span className="text-primary font-medium">Multi-select</span></>)}
              </div>
              <Button
                variant={currentA?.isFlagged ? "default" : "outline"}
                size="sm"
                onClick={() => updateAnswer(currentQ.id, { isFlagged: !currentA.isFlagged })}
                className={currentA?.isFlagged ? "bg-primary text-primary-foreground" : ""}
              >
                <Flag className={cn("h-3.5 w-3.5", currentA?.isFlagged && "fill-current")} />
                {currentA?.isFlagged ? "Flagged" : "Flag"}
              </Button>
            </div>

            {/* Question bodies are cleaned HTML — MathML, sub/superscripts, tables.
                Printed as text they show raw tags, which is what the "&ndash;"
                reports were. RichText sanitises and renders. */}
            <RichText
              html={currentQ.text}
              className="text-lg md:text-xl leading-relaxed mb-8 font-medium"
            />

            {currentQ.type === "SINGLE_MCQ" && (
              <div className="space-y-2.5">
                {currentQ.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateAnswer(currentQ.id, { selectedOptionId: opt.id })}
                    className={cn(
                      "w-full text-left rounded-[10px] border-[1.5px] p-4 transition-colors",
                      currentA?.selectedOptionId === opt.id
                        ? "border-primary bg-primary-dim"
                        : "border-border bg-surface-hi/40 hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-sm font-medium",
                        currentA?.selectedOptionId === opt.id ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      )}>
                        {opt.label}
                      </div>
                      <RichText html={opt.text} className="flex-1 pt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {currentQ.type === "MULTI_MCQ" && (
              <div className="space-y-2.5">
                <p className="text-xs text-muted-foreground mb-3">Select all that apply. All correct options must be selected for credit.</p>
                {currentQ.options.map((opt) => {
                  const isSelected = currentA?.selectedOptionIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        const next = isSelected ? currentA.selectedOptionIds.filter((x) => x !== opt.id) : [...currentA.selectedOptionIds, opt.id];
                        updateAnswer(currentQ.id, { selectedOptionIds: next });
                      }}
                      className={cn(
                        "w-full text-left rounded-[10px] border-[1.5px] p-4 transition-colors",
                        isSelected ? "border-primary bg-primary-dim" : "border-border bg-surface-hi/40 hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-sm font-medium",
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        )}>
                          {isSelected ? <CheckCircle2 className="h-4 w-4" /> : opt.label}
                        </div>
                        <RichText html={opt.text} className="flex-1 pt-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQ.type === "FILL_IN_BLANK" && (
              <div>
                <Textarea
                  placeholder="Type your answer here..."
                  value={currentA?.fillAnswer || ""}
                  onChange={(e) => updateAnswer(currentQ.id, { fillAnswer: e.target.value })}
                  rows={4}
                  className="text-base bg-surface-hi border"
                />
                <p className="mt-2 text-xs text-muted-foreground">Your answer saves automatically.</p>
              </div>
            )}

            <div className="mt-10 flex items-center justify-between pt-6 border-t">
              <Button variant="outline" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
                <ChevronLeft className="h-4 w-4" />Previous
              </Button>
              {currentIdx < totalQs - 1 ? (
                <Button onClick={() => setCurrentIdx((i) => i + 1)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Next<ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => setShowSubmitModal(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
                  Review & submit<Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
            {renderPalette({
              questions: attempt.questions,
              answers,
              answeredIds,
              currentIdx,
              onJump: (idx) => setCurrentIdx(idx),
              isPractice: attempt.test.isPractice,
            })}
          </aside>
        </div>
      </div>

      {/* Mobile question palette bottom sheet */}
      <Dialog open={showPaletteSheet} onOpenChange={setShowPaletteSheet}>
        <DialogContent
          className="lg:hidden p-0 left-0 right-0 top-auto bottom-0 translate-x-0 translate-y-0 w-full max-w-full sm:rounded-t-2xl sm:rounded-b-none rounded-t-2xl rounded-b-none border-x-0 border-b-0 max-h-[85vh] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
        >
          <DialogTitle className="sr-only">Question palette</DialogTitle>
          <DialogDescription className="sr-only">
            Jump to any question. Shows answered, flagged, and unvisited status.
          </DialogDescription>
          <div className="px-4 pt-3 pb-4 overflow-y-auto">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
            {renderPalette({
              questions: attempt.questions,
              answers,
              answeredIds,
              currentIdx,
              onJump: (idx) => { setCurrentIdx(idx); setShowPaletteSheet(false); },
              isPractice: attempt.test.isPractice,
            })}
          </div>
        </DialogContent>
      </Dialog>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface border shadow-lift">
            <div className="p-6 border-b">
              <h2 className="font-display text-2xl">Submit test?</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Once submitted, you can't change your answers.</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-2">
                <SummaryStat value={answeredIds.size} label="Answered" color="text-[color:var(--score-strong)]" />
                <SummaryStat value={Object.values(answers).filter((a) => a.isFlagged).length} label="Flagged" color="text-primary" />
                <SummaryStat value={totalQs - answeredIds.size} label="Unanswered" color="text-muted-foreground" />
              </div>

              {error && <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>}
            </div>

            <div className="p-6 pt-0 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowSubmitModal(false)} disabled={submitting}>Keep working</Button>
              <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold" onClick={manualSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderPalette({
  questions,
  answers,
  answeredIds,
  currentIdx,
  onJump,
  isPractice,
}: {
  questions: Question[];
  answers: Record<number, AnswerState>;
  answeredIds: Set<number>;
  currentIdx: number;
  onJump: (idx: number) => void;
  isPractice: boolean;
}) {
  const totalQs = questions.length;
  return (
    <>
      <div className="rounded-2xl border bg-surface p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="font-medium text-sm">Questions</h3>
          <span className="text-xs text-muted-foreground">{answeredIds.size} / {totalQs}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Tap to jump</p>

        <div className="grid grid-cols-5 gap-1.5 mb-5">
          {questions.map((q, idx) => {
            const isAnswered = answeredIds.has(q.id);
            const isFlagged = answers[q.id]?.isFlagged;
            const isCurrent = idx === currentIdx;
            return (
              <button
                key={q.id}
                onClick={() => onJump(idx)}
                className={cn(
                  "relative h-9 w-9 rounded-lg text-xs font-medium border transition-all",
                  isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
                  isAnswered && !isFlagged && "bg-primary-dim border-primary/40 text-primary",
                  isAnswered && isFlagged && "bg-primary border-primary text-primary-foreground",
                  !isAnswered && isFlagged && "border-primary/40 text-primary",
                  !isAnswered && !isFlagged && "bg-surface-hi border-border hover:bg-white/5 text-muted-foreground"
                )}
              >
                {idx + 1}
                {isFlagged && <Flag className="absolute -top-1 -right-1 h-3 w-3 text-primary fill-primary" />}
              </button>
            );
          })}
        </div>

        <div className="space-y-2 text-xs border-t pt-4">
          <LegendItem color="bg-primary-dim border-primary/40" label="Answered" />
          <LegendItem color="border-primary/40 bg-transparent" label="Flagged" />
          <LegendItem color="bg-surface-hi border-border" label="Not visited" />
        </div>
      </div>

      {isPractice && (
        <div className="mt-3 rounded-2xl border bg-primary-dim p-4 text-xs">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">Practice mode — take your time. No timer pressure.</p>
          </div>
        </div>
      )}
    </>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-3.5 w-3.5 rounded border", color)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function SummaryStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border bg-surface-hi p-3 text-center">
      <p className={cn("font-display text-3xl", color)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
