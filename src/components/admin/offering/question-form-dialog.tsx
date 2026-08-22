"use client";

/**
 * Add / edit a single question — the counterpart to bulk import.
 *
 * One form serves both verbs: create posts, edit patches, and the only
 * difference is whether it opens empty or pre-filled. That matters because the
 * two must agree on what a valid question is; two forms would drift.
 *
 * Validation mirrors the importer rule for rule (single = exactly 1 correct,
 * multi >= 2, MCQ >= 2 options, fill needs an accepted answer). The same rules
 * are enforced server-side on both routes — this is the courtesy copy that
 * explains the problem before a round trip, never the authority.
 *
 * On save the **full** option set goes up: PATCH replaces options wholesale, so
 * a partial list would silently drop the ones left out.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichText } from "@/components/rich-text";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

export const OPTION_LABELS = ["A", "B", "C", "D"] as const;

export type EditableType = "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK";

export interface QuestionDraft {
  id?: number;
  chapterId: string;
  type: EditableType;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  text: string;
  explanation: string;
  marks: number;
  /** Always four slots, A–D; blanks are dropped on save. */
  options: Array<{ text: string; isCorrect: boolean }>;
  correctText: string;
}

export function emptyDraft(): QuestionDraft {
  return {
    chapterId: "",
    type: "SINGLE_MCQ",
    difficulty: "MEDIUM",
    text: "",
    explanation: "",
    marks: 1,
    options: OPTION_LABELS.map(() => ({ text: "", isCorrect: false })),
    correctText: "",
  };
}

/** The importer's rules, in the order a author is most likely to trip them. */
export function validateDraft(d: QuestionDraft): string | null {
  if (!d.text.trim()) return "Question text is required.";
  if (!Number.isFinite(d.marks) || d.marks < 1) return "Marks must be at least 1.";

  if (d.type === "FILL_IN_BLANK") {
    return d.correctText.trim() ? null : "Fill-in-the-blank needs an accepted answer.";
  }

  const filled = d.options.filter((o) => o.text.trim());
  if (filled.length < 2) return "An MCQ needs at least 2 options with text.";

  // A tick on an empty option would be dropped on save and silently change the
  // answer, so it is an error here rather than a quiet correction.
  if (d.options.some((o) => o.isCorrect && !o.text.trim())) {
    return "An option marked correct has no text.";
  }

  const correct = filled.filter((o) => o.isCorrect).length;
  if (d.type === "SINGLE_MCQ" && correct !== 1) {
    return "A single-answer question needs exactly 1 correct option.";
  }
  if (d.type === "MULTI_MCQ" && correct < 2) {
    return "A multi-answer question needs at least 2 correct options.";
  }
  return null;
}

/** The wire shape both routes accept. */
export function draftToPayload(d: QuestionDraft) {
  const isFill = d.type === "FILL_IN_BLANK";
  return {
    chapterId: d.chapterId ? Number(d.chapterId) : null,
    type: d.type,
    difficulty: d.difficulty,
    text: d.text.trim(),
    explanation: d.explanation.trim() || null,
    marks: d.marks,
    // Switching to fill clears the option set; switching away clears the
    // accepted answer. Sending both would leave stale data behind whichever
    // way the type moved.
    correctText: isFill ? d.correctText.trim() : null,
    options: isFill
      ? []
      : d.options
          .map((o, i) => ({ label: OPTION_LABELS[i], text: o.text.trim(), isCorrect: o.isCorrect }))
          .filter((o) => o.text),
  };
}

export function QuestionFormDialog({
  open, onOpenChange, draft, setDraft, chapters, saving, error, usedInTests, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: QuestionDraft;
  setDraft: (d: QuestionDraft) => void;
  chapters: Array<{ id: number; name: string }>;
  saving: boolean;
  error: string | null;
  /** > 0 shows the in-use disclosure when editing. */
  usedInTests: number;
  onSave: () => void;
}) {
  const isEdit = draft.id != null;
  const isFill = draft.type === "FILL_IN_BLANK";
  // Errors stay hidden until the first save attempt, so a half-typed question
  // is not shouted at. Keyed by the question being edited: opening a different
  // one starts quiet again without an effect resetting state on open.
  const [attemptedFor, setAttemptedFor] = useState<number | "new" | null>(null);
  const identity: number | "new" = draft.id ?? "new";
  const touched = attemptedFor === identity;

  const problem = useMemo(() => validateDraft(draft), [draft]);

  function set<K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) {
    setDraft({ ...draft, [key]: value });
  }

  function setOption(i: number, patch: Partial<{ text: string; isCorrect: boolean }>) {
    setDraft({ ...draft, options: draft.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  }

  /** Radio for single, checkbox for multi — the control *is* the rule. */
  function pickCorrect(i: number, checked: boolean) {
    if (draft.type === "SINGLE_MCQ") {
      setDraft({ ...draft, options: draft.options.map((o, idx) => ({ ...o, isCorrect: idx === i })) });
    } else {
      setOption(i, { isCorrect: checked });
    }
  }

  function changeType(next: EditableType) {
    // Coming back to single from multi can leave several ticks, which the
    // radio group cannot express. Keep the first and drop the rest.
    if (next === "SINGLE_MCQ") {
      let seen = false;
      const options = draft.options.map((o) => {
        if (o.isCorrect && !seen) { seen = true; return o; }
        return { ...o, isCorrect: false };
      });
      setDraft({ ...draft, type: next, options });
      return;
    }
    setDraft({ ...draft, type: next });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit question #${draft.id}` : "Add question"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Changes apply everywhere this question appears. Marks already awarded are snapshotted on past attempts and are not recalculated."
              : "Adds one question to this subject's bank. Tag it to a chapter to bring it onto this offering's shelf."}
          </DialogDescription>
        </DialogHeader>

        {isEdit && usedInTests > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              In <strong>{usedInTests}</strong> test{usedInTests === 1 ? "" : "s"}. Editing the
              options replaces them, so students sitting it from now on see the new set. Past
              attempts keep the scores they were given.
            </span>
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium sm:col-span-1">
            Chapter
            <Select
              value={draft.chapterId}
              onChange={(e) => set("chapterId", e.target.value)}
              className="mt-1 h-10 w-full"
            >
              <option value="">— No chapter —</option>
              {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </label>
          <label className="text-xs font-medium sm:col-span-1">
            Type
            <Select
              value={draft.type}
              onChange={(e) => changeType(e.target.value as EditableType)}
              className="mt-1 h-10 w-full"
            >
              <option value="SINGLE_MCQ">Single answer</option>
              <option value="MULTI_MCQ">Multiple answers</option>
              <option value="FILL_IN_BLANK">Fill in the blank</option>
            </Select>
          </label>
          <label className="text-xs font-medium sm:col-span-1">
            Difficulty
            <Select
              value={draft.difficulty}
              onChange={(e) => set("difficulty", e.target.value as QuestionDraft["difficulty"])}
              className="mt-1 h-10 w-full"
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </Select>
          </label>
        </div>

        <label className="text-xs font-medium">
          Question
          <Textarea
            value={draft.text}
            onChange={(e) => set("text", e.target.value)}
            rows={4}
            placeholder="Question text — HTML and MathML are supported"
            className="mt-1"
          />
        </label>
        {draft.text.trim() && (
          <div className="rounded-lg border bg-surface-hi/40 p-2.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            {/* Rendered, never raw — the author has to read the maths to judge it. */}
            <RichText html={draft.text} />
          </div>
        )}

        {isFill ? (
          <label className="text-xs font-medium">
            Accepted answer
            <Input
              value={draft.correctText}
              onChange={(e) => set("correctText", e.target.value)}
              placeholder="e.g. 42"
              className="mt-1 h-10"
            />
            <span className="mt-1 block font-normal text-muted-foreground">
              Recorded for reference — fill-in-the-blank is <strong>not auto-graded</strong>, the
              same limitation as import.
            </span>
          </label>
        ) : (
          <fieldset>
            <legend className="text-xs font-medium">
              Options — mark {draft.type === "SINGLE_MCQ" ? "the correct one" : "every correct one"}
            </legend>
            <div className="mt-1 space-y-2">
              {draft.options.map((o, i) => (
                <div key={OPTION_LABELS[i]} className="flex items-center gap-2">
                  <label
                    className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border text-xs font-medium"
                    title={`Mark ${OPTION_LABELS[i]} correct`}
                  >
                    <input
                      type={draft.type === "SINGLE_MCQ" ? "radio" : "checkbox"}
                      name="correct-option"
                      checked={o.isCorrect}
                      onChange={(e) => pickCorrect(i, e.target.checked)}
                      aria-label={`Option ${OPTION_LABELS[i]} is correct`}
                      className="h-3.5 w-3.5 cursor-pointer accent-[var(--primary)]"
                    />
                    {OPTION_LABELS[i]}
                  </label>
                  <Input
                    value={o.text}
                    onChange={(e) => setOption(i, { text: e.target.value })}
                    placeholder={`Option ${OPTION_LABELS[i]}`}
                    className="h-10"
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium sm:col-span-2">
            Explanation <span className="font-normal text-muted-foreground">(optional)</span>
            <Textarea
              value={draft.explanation}
              onChange={(e) => set("explanation", e.target.value)}
              rows={2}
              className="mt-1"
            />
          </label>
          <label className="text-xs font-medium sm:col-span-1">
            Marks
            <Input
              type="number"
              min={1}
              value={draft.marks}
              onChange={(e) => set("marks", Number(e.target.value))}
              className="mt-1 h-10"
            />
          </label>
        </div>

        {/* The server's message wins when it disagrees — it is the authority. */}
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {!error && touched && problem && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {problem}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => { setAttemptedFor(identity); if (!problem) onSave(); }}
            disabled={saving || (touched && !!problem)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Save changes" : "Add question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
