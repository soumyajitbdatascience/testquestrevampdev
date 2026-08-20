"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RichText } from "@/components/rich-text";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Question picker for a test.
 *
 * Draws only on this offering's bank, and keeps a running "N selected · M
 * marks" so the paper is built to a target rather than counted afterwards.
 * Selection persists across pages and filters — the running total is the whole
 * point, so it must not reset when you go looking for the next question.
 */
interface PickerQuestion {
  id: number;
  text: string;
  type: string;
  difficulty: string;
  marks: number;
  chapter: { id: number; name: string; isThisOffering: boolean } | null;
}
interface Chapter { id: number; name: string }

export function TestQuestionPicker({
  offeringId,
  test,
  onClose,
  onSaved,
}: {
  offeringId: number;
  test: { id: number; name: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [questions, setQuestions] = useState<PickerQuestion[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [chapterId, setChapterId] = useState("");

  /** id → marks, so the running total survives paging away from a row. */
  const [selected, setSelected] = useState<Map<number, number>>(new Map());
  const [initialised, setInitialised] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Existing question set — the starting selection.
  useEffect(() => {
    fetch(`/api/admin/offerings/${offeringId}/tests/${test.id}/questions`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setSelected(new Map(d.data.questions.map((q: PickerQuestion) => [q.id, q.marks])));
        }
        setInitialised(true);
      });
    fetch(`/api/admin/offerings/${offeringId}/chapters`)
      .then((r) => r.json())
      .then((d) => d.ok && setChapters(d.data.map((c: Chapter) => ({ id: c.id, name: c.name }))));
  }, [offeringId, test.id]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: "25", scope: "offering" });
    if (search.trim()) qs.set("search", search.trim());
    if (chapterId) qs.set("chapterId", chapterId);
    try {
      const res = await fetch(`/api/admin/offerings/${offeringId}/questions?${qs}`, { signal });
      const data = await res.json();
      if (signal?.aborted) return;
      if (data.ok) {
        setQuestions(data.data.questions);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      }
      setLoading(false);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setLoading(false);
    }
  }, [offeringId, page, search, chapterId]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => load(controller.signal), search ? 300 : 0);
    return () => { clearTimeout(t); controller.abort(); };
  }, [load, search]);

  useEffect(() => { setPage(1); }, [search, chapterId]);

  function toggle(q: PickerQuestion) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) next.delete(q.id); else next.set(q.id, q.marks);
      return next;
    });
  }

  function toggleAllOnPage() {
    const allSelected = questions.length > 0 && questions.every((q) => selected.has(q.id));
    setSelected((prev) => {
      const next = new Map(prev);
      for (const q of questions) {
        if (allSelected) next.delete(q.id); else next.set(q.id, q.marks);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/offerings/${offeringId}/tests/${test.id}/questions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIds: [...selected.keys()] }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) onSaved();
    else setError(data.error || "Could not save the question set");
  }

  const totalMarks = [...selected.values()].reduce((a, b) => a + b, 0);
  const allOnPageSelected = questions.length > 0 && questions.every((q) => selected.has(q.id));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Questions in “{test.name}”</DialogTitle>
          <DialogDescription>
            Pick from this offering&apos;s bank. Your selection is kept as you search and page.
          </DialogDescription>
        </DialogHeader>

        {/* Running total — the reason this screen exists. */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">
            {selected.size} selected · {totalMarks} mark{totalMarks === 1 ? "" : "s"}
          </span>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Map())} className="text-xs text-muted-foreground underline">
              Clear all
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question text"
            className="h-9 max-w-xs"
          />
          <Select value={chapterId} onChange={(e) => setChapterId(e.target.value)} className="h-9 w-auto min-w-[12rem]">
            <option value="">All chapters</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>

        <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
          {!initialised || loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : questions.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No questions in this offering match. Tag questions to its chapters first.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 border-b bg-surface-hi text-left text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage}
                      aria-label="Select all on page"
                      className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Question</th>
                  <th className="w-28 px-3 py-2 font-medium">Chapter</th>
                  <th className="w-16 px-3 py-2 text-right font-medium">Marks</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr
                    key={q.id}
                    className={
                      selected.has(q.id)
                        ? "cursor-pointer border-b bg-primary/5 last:border-0"
                        : "cursor-pointer border-b last:border-0 hover:bg-surface-hi/40"
                    }
                    onClick={() => toggle(q)}
                  >
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select question ${q.id}`}
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--primary)]"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <RichText html={q.text} clamp={2} />
                    </td>
                    <td className="px-3 py-2 align-top text-xs">{q.chapter?.name ?? "—"}</td>
                    <td className="px-3 py-2 align-top text-right tabular-nums">{q.marks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{total.toLocaleString()} available · page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {selected.size === 0 && initialised && (
          <p className="text-xs text-muted-foreground">
            Saving with nothing selected empties the test and returns it to draft.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save {selected.size} question{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
