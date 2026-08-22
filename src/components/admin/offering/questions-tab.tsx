"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RichText } from "@/components/rich-text";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Upload, Download, ChevronLeft, ChevronRight, HelpCircle,
  AlertTriangle, ImageOff, ChevronDown, ChevronUp, Plus, Pencil, Archive,
} from "lucide-react";
import {
  QuestionFormDialog, emptyDraft, draftToPayload, validateDraft,
  OPTION_LABELS, type QuestionDraft, type EditableType,
} from "@/components/admin/offering/question-form-dialog";

/**
 * Questions tab — the offering's question bank.
 *
 * Built for volume: the bank runs to thousands of rows, so it is server
 * paginated and every filter round-trips. Previews are RENDERED (HTML + native
 * MathML), never raw tags — a content author has to be able to read the maths
 * to judge the question.
 *
 * Bulk-first: select rows, assign a chapter in one action. Chapter tagging is
 * what scopes a shared-bank question to this shelf, so it's the primary verb.
 *
 * Single-question add / edit / archive live here too, sharing one form
 * (`question-form-dialog.tsx`) so create and edit cannot disagree about what a
 * valid question is.
 */

/** The three types the form can express. Paragraph and Subjective are shown in
 *  the list but not editable here — opening one in a three-type form would
 *  silently convert it. */
const EDITABLE_TYPES = new Set(["SINGLE_MCQ", "MULTI_MCQ", "FILL_IN_BLANK"]);
interface QOption { id: number; label: string; text: string; isCorrect: boolean }
interface Question {
  id: number;
  type: "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK" | "PARAGRAPH" | "SUBJECTIVE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  text: string;
  explanation: string | null;
  correctText: string | null;
  marks: number;
  chapter: { id: number; name: string; isThisOffering: boolean } | null;
  options: QOption[];
  usedInTests: number;
  flags: { unrenderableMath: boolean; deadImage: boolean };
}
interface Chapter { id: number; name: string }

const TYPE_LABEL: Record<string, string> = {
  SINGLE_MCQ: "Single", MULTI_MCQ: "Multi", FILL_IN_BLANK: "Fill",
  PARAGRAPH: "Passage", SUBJECTIVE: "Written",
};

export function QuestionsTab({ offeringId, onChanged }: { offeringId: number; onChanged?: () => void }) {
  const searchParams = useSearchParams();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [chapterId, setChapterId] = useState(searchParams.get("chapterId") ?? "");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  // "offering" = this shelf's own questions. "subject" = the shared pool the
  // subject draws on, spanning every class that offers it.
  const [scope, setScope] = useState<"offering" | "subject">("offering");

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number; skipped: number; total: number;
    errors: Array<{ row: number; message: string }>; truncatedErrors: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft());
  const [draftUsedIn, setDraftUsedIn] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Question | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  /**
   * `signal` lets a superseded request drop its result. Without it, typing
   * quickly in the search box can land an older response after a newer one and
   * show the wrong rows for the current filters.
   */
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: "25", scope });
    if (search.trim()) qs.set("search", search.trim());
    if (chapterId) qs.set("chapterId", chapterId);
    if (type) qs.set("type", type);
    if (difficulty) qs.set("difficulty", difficulty);

    try {
      const res = await fetch(`/api/admin/offerings/${offeringId}/questions?${qs}`, { signal });
      const data = await res.json();
      if (signal?.aborted) return;
      if (data.ok) {
        setQuestions(data.data.questions);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      } else {
        setError(data.error || "Could not load questions");
      }
      setLoading(false);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError("Could not load questions");
      setLoading(false);
    }
  }, [offeringId, page, search, chapterId, type, difficulty, scope]);

  useEffect(() => {
    fetch(`/api/admin/offerings/${offeringId}/chapters`)
      .then((r) => r.json())
      .then((d) => d.ok && setChapters(d.data.map((c: Chapter) => ({ id: c.id, name: c.name }))));
  }, [offeringId]);

  // Debounce the search box; every other filter applies immediately. The
  // controller cancels an in-flight request when the filters change again.
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => load(controller.signal), search ? 300 : 0);
    return () => { clearTimeout(t); controller.abort(); };
  }, [load, search]);

  /**
   * Changing a filter resets to page 1 and drops the selection — staying on
   * page 7 of a narrower result set lands you on an empty page, and a
   * selection made against different filters is not what "N selected" implies.
   * Done here in the handler rather than in an effect watching the filters.
   */
  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
    setSelected(new Set());
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    const ids = questions.map((q) => q.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) { if (allSelected) next.delete(id); else next.add(id); }
      return next;
    });
  }

  async function assignChapter(target: string) {
    if (selected.size === 0) return;
    const chapterIdValue = target === "none" ? null : Number(target);
    const label = target === "none"
      ? "untagged"
      : chapters.find((c) => c.id === Number(target))?.name ?? "that chapter";
    if (!confirm(`Move ${selected.size} question(s) to ${label}?`)) return;

    setAssigning(true);
    setError(null);
    const res = await fetch(`/api/admin/offerings/${offeringId}/questions/assign-chapter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIds: [...selected], chapterId: chapterIdValue }),
    });
    const data = await res.json();
    setAssigning(false);
    if (data.ok) {
      setNotice(
        `Moved ${data.data.updated} question(s) to ${label}` +
        (data.data.skipped ? ` · ${data.data.skipped} skipped` : ""),
      );
      setSelected(new Set());
      setAssignTo("");
      load();
      onChanged?.();
    } else {
      setError(data.error || "Could not reassign those questions");
    }
  }

  async function runImport(file: File) {
    setImporting(true);
    setImportResult(null);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/admin/offerings/${offeringId}/questions/import`, { method: "POST", body });
    const data = await res.json();
    setImporting(false);
    if (data.ok) {
      setImportResult(data.data);
      load();
      onChanged?.();
    } else {
      setError(data.error || "Import failed");
    }
  }

  function openAdd() {
    // A chapter filter is a statement of intent — pre-tag the new question to it.
    const d = emptyDraft();
    if (chapterId && chapters.some((c) => String(c.id) === chapterId)) d.chapterId = chapterId;
    setDraft(d);
    setDraftUsedIn(0);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(q: Question) {
    // Four fixed slots so the labels stay A–D; anything the question carries
    // beyond D (legacy imports allow up to F) would be dropped on save, so
    // those rows are not offered for editing in the first place.
    const options = OPTION_LABELS.map((label) => {
      const existing = q.options.find((o) => o.label.toUpperCase() === label);
      return { text: existing?.text ?? "", isCorrect: existing?.isCorrect ?? false };
    });
    setDraft({
      id: q.id,
      chapterId: q.chapter?.isThisOffering ? String(q.chapter.id) : "",
      type: q.type as EditableType,
      difficulty: q.difficulty,
      text: q.text,
      explanation: q.explanation ?? "",
      marks: q.marks,
      options,
      correctText: q.correctText ?? "",
    });
    setDraftUsedIn(q.usedInTests);
    setFormError(null);
    setFormOpen(true);
  }

  async function saveQuestion() {
    const problem = validateDraft(draft);
    if (problem) { setFormError(problem); return; }

    setSaving(true);
    setFormError(null);
    const payload = draftToPayload(draft);
    const isEdit = draft.id != null;
    const res = await fetch(
      isEdit
        ? `/api/admin/offerings/${offeringId}/questions/${draft.id}`
        : `/api/admin/offerings/${offeringId}/questions`,
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    setSaving(false);
    if (!data.ok) { setFormError(data.error || "Could not save that question"); return; }

    setFormOpen(false);
    setNotice(isEdit ? `Saved question #${draft.id}` : `Added question #${data.data.id}`);
    load();
    onChanged?.();
  }

  /**
   * Archive, not delete. The route refuses (409) while any test still contains
   * the question, so a question in use is blocked here rather than offered and
   * then rejected — and if the server refuses anyway, its message is shown
   * verbatim rather than reworded.
   */
  async function archiveQuestion() {
    if (!archiveTarget) return;
    setArchiving(true);
    setArchiveError(null);
    const res = await fetch(
      `/api/admin/offerings/${offeringId}/questions/${archiveTarget.id}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setArchiving(false);
    if (!data.ok) { setArchiveError(data.error || "Could not archive that question"); return; }

    const archivedId = archiveTarget.id;
    setArchiveTarget(null);
    setNotice(`Archived question #${archivedId}`);
    load();
    onChanged?.();
  }

  const allOnPageSelected = questions.length > 0 && questions.every((q) => selected.has(q.id));

  return (
    <div className="space-y-4">
      {/* Scope — which pool you're looking at. */}
      <div className="inline-flex rounded-lg border bg-card p-0.5 text-[13px]">
        <button
          onClick={() => changeFilter(() => { setScope("offering"); setChapterId(""); })}
          className={
            scope === "offering"
              ? "rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
              : "rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
          }
        >
          This offering
        </button>
        <button
          onClick={() => changeFilter(() => { setScope("subject"); setChapterId(""); })}
          className={
            scope === "subject"
              ? "rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
              : "rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
          }
          title="Every question for this subject, across all classes that offer it"
        >
          Shared subject pool
        </button>
      </div>
      {scope === "subject" && (
        <p className="-mt-1 text-xs text-muted-foreground">
          Showing every question for this subject across all classes that offer it. Tag one to a
          chapter here to bring it onto this shelf.
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          placeholder="Search question text"
          className="h-10 max-w-xs"
        />
        <Select value={chapterId} onChange={(e) => changeFilter(() => setChapterId(e.target.value))} className="h-10 w-auto min-w-[12rem]">
          <option value="">All chapters</option>
          {scope === "subject" && <option value="none">Untagged</option>}
          {scope === "subject" && <option value="other">Tagged to another class</option>}
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={type} onChange={(e) => changeFilter(() => setType(e.target.value))} className="h-10 w-auto min-w-[9rem]">
          <option value="">All types</option>
          <option value="SINGLE_MCQ">Single answer</option>
          <option value="MULTI_MCQ">Multi answer</option>
          <option value="FILL_IN_BLANK">Fill in blank</option>
        </Select>
        <Select value={difficulty} onChange={(e) => changeFilter(() => setDifficulty(e.target.value))} className="h-10 w-auto min-w-[8rem]">
          <option value="">Any level</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/api/admin/offerings/${offeringId}/questions/template`}>
              <Download className="h-4 w-4" />
              Template
            </a>
          </Button>
          <Button variant="outline" onClick={() => { setImportResult(null); setImportOpen(true); }}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add question
          </Button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-green-600/30 bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Bulk bar — appears only with a selection */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select
            value={assignTo}
            onChange={(e) => { setAssignTo(e.target.value); if (e.target.value) assignChapter(e.target.value); }}
            className="h-8 w-auto min-w-[13rem]"
            disabled={assigning}
          >
            <option value="">Move to chapter…</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">— Remove chapter —</option>
          </Select>
          {assigning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground underline">
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-16 text-center">
          <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No questions match</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 && !search && !chapterId && !type && !difficulty
              ? scope === "offering"
                ? "Nothing is tagged to this offering's chapters yet. Import a workbook, or switch to the shared subject pool and tag existing questions."
                : "Import a workbook to fill this subject's pool."
              : "Try clearing a filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-[13px]">
            <thead className="border-b bg-surface-hi/50 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all on page"
                    className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                  />
                </th>
                <th className="px-3 py-2 font-medium">Question</th>
                <th className="w-32 px-3 py-2 font-medium">Chapter</th>
                <th className="w-20 px-3 py-2 font-medium">Type</th>
                <th className="w-20 px-3 py-2 font-medium">Level</th>
                <th className="w-20 px-3 py-2 text-right font-medium">In tests</th>
                <th className="w-36 px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => {
                const isOpen = expanded.has(q.id);
                const editable = EDITABLE_TYPES.has(q.type);
                return (
                  // A row renders as two <tr> siblings when expanded, so the
                  // key belongs on the Fragment, not the individual rows.
                  <Fragment key={q.id}>
                    <tr className="border-b last:border-0 align-top hover:bg-surface-hi/40">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(q.id)}
                          onChange={() => toggle(q.id)}
                          aria-label={`Select question ${q.id}`}
                          className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--primary)]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <RichText html={q.text} clamp={isOpen ? undefined : 2} />
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] text-muted-foreground">#{q.id}</span>
                          {q.flags.unrenderableMath && (
                            <Badge variant="warning" className="text-[10px]" title="Contains Word (OMML) math that could not be fully converted">
                              <AlertTriangle className="mr-1 h-2.5 w-2.5" />
                              math
                            </Badge>
                          )}
                          {q.flags.deadImage && (
                            <Badge variant="warning" className="text-[10px]" title="References an image that no longer exists">
                              <ImageOff className="mr-1 h-2.5 w-2.5" />
                              image
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {q.chapter ? (
                          q.chapter.isThisOffering ? (
                            <span className="text-xs">{q.chapter.name}</span>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]" title={`Tagged to "${q.chapter.name}" in another class's offering`}>
                              another class
                            </Badge>
                          )
                        ) : (
                          <Badge variant="warning" className="text-[10px]">untagged</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs">{TYPE_LABEL[q.type] ?? q.type}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant={q.difficulty === "EASY" ? "success" : q.difficulty === "HARD" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {q.difficulty.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {q.usedInTests === 0
                          ? <span className="text-muted-foreground">—</span>
                          : q.usedInTests}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => editable && openEdit(q)}
                            disabled={!editable}
                            className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Edit question ${q.id}`}
                            title={editable
                              ? "Edit question"
                              : `${TYPE_LABEL[q.type] ?? q.type} questions can't be edited here — this form covers single, multi and fill only`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setArchiveError(null); setArchiveTarget(q); }}
                            className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                            aria-label={`Archive question ${q.id}`}
                            title="Archive question"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                              return next;
                            })}
                            className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                            aria-label={isOpen ? "Collapse" : "Expand"}
                          >
                            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b bg-surface-hi/30 last:border-0">
                        <td />
                        <td colSpan={6} className="px-3 pb-4 pt-1">
                          {q.options.length > 0 ? (
                            <ol className="space-y-1.5">
                              {q.options.map((o) => (
                                <li key={o.id} className="flex gap-2">
                                  <span className={
                                    o.isCorrect
                                      ? "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-green-600 text-[10px] font-bold text-white"
                                      : "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground"
                                  }>
                                    {o.label}
                                  </span>
                                  <RichText html={o.text} className="flex-1" />
                                </li>
                              ))}
                            </ol>
                          ) : q.correctText ? (
                            <p className="text-xs">
                              <span className="text-muted-foreground">Accepted answer: </span>
                              <span className="font-medium">{q.correctText}</span>
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No options recorded</p>
                          )}
                          {q.explanation && (
                            <div className="mt-3 rounded-lg bg-card p-2.5">
                              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Explanation
                              </p>
                              <RichText html={q.explanation} />
                            </div>
                          )}
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {q.marks} mark{q.marks > 1 ? "s" : ""}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {total.toLocaleString()} question{total === 1 ? "" : "s"} · page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import questions</DialogTitle>
            <DialogDescription>
              Upload an .xlsx or .csv. Download the template first — it carries this offering&apos;s
              chapter names, and the chapter column matches on name. Rows with problems are
              reported and skipped; the rest still import.
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="rounded-lg bg-green-50 px-3 py-2 dark:bg-green-950/30">
                  <p className="text-lg font-medium text-green-700 dark:text-green-400">{importResult.imported}</p>
                  <p className="text-xs text-muted-foreground">imported</p>
                </div>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-lg font-medium">{importResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">skipped</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <tbody>
                      {importResult.errors.map((e, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="w-16 px-2 py-1 font-mono text-muted-foreground">row {e.row}</td>
                          <td className="px-2 py-1">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importResult.truncatedErrors > 0 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      …and {importResult.truncatedErrors} more
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={importing}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) runImport(f); }}
              className="block w-full cursor-pointer rounded-lg border border-dashed p-6 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
            />
          )}
          {importing && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing…
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportResult(null); }}>
              {importResult ? "Done" : "Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / edit — one form, both verbs. */}
      <QuestionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        draft={draft}
        setDraft={setDraft}
        chapters={chapters}
        saving={saving}
        error={formError}
        usedInTests={draftUsedIn}
        onSave={saveQuestion}
      />

      {/* Archive confirm */}
      <Dialog open={archiveTarget != null} onOpenChange={(v) => { if (!v) setArchiveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive question #{archiveTarget?.id}</DialogTitle>
            <DialogDescription>
              {archiveTarget && archiveTarget.usedInTests > 0
                ? `This question is used by ${archiveTarget.usedInTests} test${archiveTarget.usedInTests === 1 ? "" : "s"}.`
                : "It will be hidden from the question bank. Past attempts keep their answers and scores."}
            </DialogDescription>
          </DialogHeader>

          {archiveTarget && archiveTarget.usedInTests > 0 ? (
            // Blocked rather than offered-then-rejected: the route refuses
            // while any test still contains the question, so there is nothing
            // to confirm here — only somewhere to go.
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                Remove it from those tests first — a test cannot lose a question it is already
                built from. Open the Tests tab, edit each test&apos;s question list, then archive
                it here.
              </span>
            </p>
          ) : (
            <div className="rounded-lg border bg-surface-hi/40 p-2.5">
              <RichText html={archiveTarget?.text ?? ""} clamp={3} />
            </div>
          )}

          {archiveError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {archiveError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)} disabled={archiving}>
              {archiveTarget && archiveTarget.usedInTests > 0 ? "Close" : "Cancel"}
            </Button>
            {archiveTarget && archiveTarget.usedInTests === 0 && (
              <Button variant="destructive" onClick={archiveQuestion} disabled={archiving}>
                {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Archive"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
