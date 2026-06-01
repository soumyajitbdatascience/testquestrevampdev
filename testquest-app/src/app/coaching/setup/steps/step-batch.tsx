"use client";

/**
 * Step 3 — Create your first batch.
 *
 * Required: name + classId + board + at least one subject.
 * Subjects: free-text chip input (comma-separated quick-add) — the legacy
 * subject taxonomy has 800+ rows so a hand-typed list is faster for an owner
 * than picking from a giant dropdown. The wizard stores the resulting CSV in
 * tq_batches.subjectsCsv.
 */
import { useEffect, useMemo, useState } from "react";
import { Field } from "@/components/coaching/field";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const BOARDS = ["CBSE", "ICSE", "State"];

interface ClassChoice { id: number; name: string }

export interface StepBatchValue {
  name: string;
  classId: number | null;
  board: string;
  subjects: string[];
}

export interface StepBatchProps {
  initial: StepBatchValue;
  /** Class IDs the owner picked in step 2; this is the dropdown source. */
  classChoices: ClassChoice[];
  loading: boolean;
  onSubmit: (value: StepBatchValue) => void;
  onValidityChange: (valid: boolean) => void;
  registerSubmit: (fn: () => void) => void;
}

export function StepBatch({ initial, classChoices, loading, onSubmit, onValidityChange, registerSubmit }: StepBatchProps) {
  const [name, setName] = useState(initial.name);
  const [classId, setClassId] = useState<number | null>(initial.classId);
  const [board, setBoard] = useState(initial.board || BOARDS[0]);
  const [subjects, setSubjects] = useState<string[]>(initial.subjects);
  const [subjectInput, setSubjectInput] = useState("");

  const valid = useMemo(
    () => name.trim().length > 0 && classId !== null && board.length > 0 && subjects.length > 0,
    [name, classId, board, subjects],
  );
  useEffect(() => onValidityChange(valid), [valid, onValidityChange]);

  function addSubject() {
    const raw = subjectInput.trim();
    if (!raw) return;
    const newOnes = raw.split(",").map((s) => s.trim()).filter(Boolean);
    setSubjects((cur) => Array.from(new Set([...cur, ...newOnes])).slice(0, 20));
    setSubjectInput("");
  }

  registerSubmit(() =>
    onSubmit({ name: name.trim(), classId, board, subjects }),
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-widest text-primary">Step 3</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">
          Your first <em className="text-primary">batch.</em>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A batch is a group of students you teach together — e.g. one class, one timing.
        </p>
      </header>

      <Field
        id="batchName"
        label="Batch name"
        value={name}
        onChange={setName}
        placeholder="Class 10 CBSE Morning 2026"
        hint="A descriptive name helps when you add more batches later."
        disabled={loading}
      />

      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none">Class</label>
        <select
          value={classId ?? ""}
          onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}
          disabled={loading}
          className="h-11 w-full rounded-md border bg-surface px-3 text-sm"
        >
          <option value="">Choose a class</option>
          {classChoices.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {classChoices.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Pick at least one class in step 2 to populate this list.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Board</p>
        <div className="flex flex-wrap gap-2">
          {BOARDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => !loading && setBoard(b)}
              disabled={loading}
              aria-pressed={board === b}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-all",
                board === b
                  ? "bg-primary text-primary-foreground border-primary shadow-gold"
                  : "bg-surface text-foreground/90 border-border hover:border-primary/40",
                loading && "opacity-60 cursor-not-allowed",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Subjects</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={subjectInput}
            onChange={(e) => setSubjectInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubject(); } }}
            disabled={loading}
            placeholder="Mathematics, Science, English"
            className="h-11 flex-1 rounded-md border bg-surface px-3 text-sm"
          />
          <button
            type="button"
            onClick={addSubject}
            disabled={loading || !subjectInput.trim()}
            className="h-11 rounded-md border border-strong px-4 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-primary-dim text-primary px-3 py-1 text-xs">
                {s}
                <button
                  type="button"
                  onClick={() => setSubjects((cur) => cur.filter((x) => x !== s))}
                  className="rounded-full hover:bg-primary/20 p-0.5"
                  aria-label={`Remove ${s}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Press Enter or comma-separate to add multiple. You can change this later from batch settings.
        </p>
      </div>
    </div>
  );
}
