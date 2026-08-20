"use client";

/**
 * Shared curriculum context selector (design §context): sticky "WORKING IN"
 * bar with Board / Class / Subject dropdown chips and a coverage readout.
 * Server-persisted per admin (api/admin/curriculum-context) so every
 * Curriculum screen opens where the admin left off.
 */
import { useCallback, useEffect, useState } from "react";
import { Select } from "@/components/ui/select";

export interface CurriculumCtx {
  boardId: number | null;
  classId: number | null;
  subjectId: number | null;
}
interface Option { id: number; name: string }

export function useCurriculumContext(requireSubject = true) {
  const [ctx, setCtx] = useState<CurriculumCtx | null>(null);
  const update = useCallback((next: CurriculumCtx) => {
    setCtx(next);
    fetch("/api/admin/curriculum-context", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }, []);
  useEffect(() => {
    fetch("/api/admin/curriculum-context").then((r) => r.json()).then((d) => {
      if (d.ok) setCtx(d.data);
    });
  }, []);
  const complete = !!ctx && ctx.boardId != null && ctx.classId != null && (!requireSubject || ctx.subjectId != null);
  return { ctx, update, complete, loaded: ctx !== null };
}

export function CurriculumContextBar({
  ctx, onChange, coverage, showSubject = true,
}: {
  ctx: CurriculumCtx | null;
  onChange: (next: CurriculumCtx) => void;
  coverage?: React.ReactNode;
  showSubject?: boolean;
}) {
  const [boards, setBoards] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);

  useEffect(() => {
    fetch("/api/admin/boards").then((r) => r.json()).then((d) => d.ok && setBoards(d.data.filter((b: { isActive: boolean }) => b.isActive)));
    fetch("/api/admin/taxonomy/classes").then((r) => r.json()).then((d) => d.ok && setClasses(d.data));
  }, []);

  useEffect(() => {
    if (!ctx?.classId) { setSubjects([]); return; }
    fetch(`/api/admin/taxonomy/subjects?classId=${ctx.classId}`).then((r) => r.json()).then((d) => {
      if (d.ok) setSubjects(d.data.map((s: { id: number; name: string }) => ({ id: s.id, name: s.name })));
    });
  }, [ctx?.classId]);

  if (!ctx) return null;

  return (
    <div className="sticky top-0 z-20 -mx-6 lg:-mx-10 mb-6 border-b-2 border-primary bg-wash px-6 lg:px-10 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted-2">Working in</span>
        <Select
          value={ctx.boardId ?? ""}
          onChange={(e) => onChange({ boardId: Number(e.target.value) || null, classId: ctx.classId, subjectId: null })}
          className="h-9 w-auto min-w-[110px] bg-card"
        >
          <option value="">Board…</option>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select
          value={ctx.classId ?? ""}
          onChange={(e) => onChange({ boardId: ctx.boardId, classId: Number(e.target.value) || null, subjectId: null })}
          className="h-9 w-auto min-w-[110px] bg-card"
        >
          <option value="">Class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {showSubject && (
          <Select
            value={ctx.subjectId ?? ""}
            onChange={(e) => onChange({ ...ctx, subjectId: Number(e.target.value) || null })}
            disabled={!ctx.classId}
            className="h-9 w-auto min-w-[160px] max-w-[280px] bg-card"
          >
            <option value="">Subject…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
        {coverage && <div className="ml-auto text-[12px] text-text-secondary">{coverage}</div>}
      </div>
    </div>
  );
}
