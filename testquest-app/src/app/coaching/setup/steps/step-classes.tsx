"use client";

/**
 * Step 2 — Boards & classes.
 *
 * Multi-select chip grid: pick boards first (CBSE / ICSE / State), then class
 * chips appear. Both required to advance. Class list is fetched from
 * /api/taxonomy which already exists and returns the legacy classes via
 * vw_classes (Class 6 → 12 plus Pre-Foundation etc).
 */
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const BOARDS = ["CBSE", "ICSE", "State"];

interface TaxClass { id: number; name: string }
interface TaxonomyResponse { ok: boolean; data: Array<{ id: number; name: string }>; }

export interface StepClassesValue {
  boards: string[];
  classIds: number[];
}

export interface StepClassesProps {
  initial: StepClassesValue;
  loading: boolean;
  onSubmit: (value: StepClassesValue) => void;
  onValidityChange: (valid: boolean) => void;
  registerSubmit: (fn: () => void) => void;
}

export function StepClasses({ initial, loading, onSubmit, onValidityChange, registerSubmit }: StepClassesProps) {
  const [boards, setBoards] = useState<string[]>(initial.boards);
  const [classIds, setClassIds] = useState<number[]>(initial.classIds);
  const [classes, setClasses] = useState<TaxClass[]>([]);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/taxonomy")
      .then((r) => r.json())
      .then((d: TaxonomyResponse) => {
        if (!d.ok) { setFetchErr("Couldn't load classes"); return; }
        setClasses(d.data.map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => setFetchErr("Couldn't load classes"));
  }, []);

  const valid = useMemo(() => boards.length > 0 && classIds.length > 0, [boards, classIds]);
  useEffect(() => onValidityChange(valid), [valid, onValidityChange]);

  function toggleBoard(b: string) {
    setBoards((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));
  }
  function toggleClass(id: number) {
    setClassIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  registerSubmit(() => onSubmit({ boards, classIds }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-widest text-primary">Step 2</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">
          Boards &amp; <em className="text-primary">classes.</em>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us what you teach so we can pre-curate question banks.
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-sm font-medium">Boards</p>
        <div className="flex flex-wrap gap-2">
          {BOARDS.map((b) => (
            <Chip key={b} selected={boards.includes(b)} onClick={() => !loading && toggleBoard(b)} disabled={loading}>
              {b}
            </Chip>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">Classes</p>
        {fetchErr ? (
          <p className="text-sm text-destructive">{fetchErr}</p>
        ) : classes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading classes…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <Chip key={c.id} selected={classIds.includes(c.id)} onClick={() => !loading && toggleClass(c.id)} disabled={loading}>
                {c.name}
              </Chip>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Chip({ children, selected, onClick, disabled }: { children: React.ReactNode; selected: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-all",
        selected
          ? "bg-primary text-primary-foreground border-primary shadow-gold"
          : "bg-surface text-foreground/90 border-border hover:border-primary/40",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}
