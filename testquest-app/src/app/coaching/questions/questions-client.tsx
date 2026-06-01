"use client";

/**
 * QuestionsClient — upload + filters + paginated list for the org's bank.
 *
 * Three regions stacked:
 *   1. Upload panel (collapsed by default; expands to show drop-zone +
 *      template download + recent import summary)
 *   2. Filters row (class, subjects, difficulty, type, free-text)
 *   3. Paginated question list with inline preview expander (same pattern
 *      as the builder so the experience is consistent).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Search,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/coaching/empty-state";
import { cn } from "@/lib/utils";

interface ClassChoice { id: number; name: string }
interface SubjectChoice { id: number; name: string; classId: number | null }

interface QRow {
  id: number;
  subjectId: number | null;
  subjectName: string | null;
  text: string;
  type: "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK" | "PARAGRAPH";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  optionCount: number;
  createdAt: string;
}
interface ListResult {
  rows: QRow[];
  total: number;
  limit: number;
  offset: number;
}
interface QDetail {
  id: number;
  text: string;
  options: Array<{ label: string; text: string; isCorrect: boolean }>;
}
interface ImportSummary {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

type Difficulty = "ALL" | "EASY" | "MEDIUM" | "HARD";
type QType = "ALL" | "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK";

const PAGE_SIZE = 25;

function diffBadge(d: string) {
  switch (d) {
    case "EASY":   return "bg-green-500/15 text-green-400";
    case "HARD":   return "bg-red-500/15 text-red-400";
    default:       return "bg-yellow-500/15 text-yellow-500";
  }
}
function typeLabel(t: string) {
  switch (t) {
    case "SINGLE_MCQ":     return "Single MCQ";
    case "MULTI_MCQ":      return "Multi MCQ";
    case "FILL_IN_BLANK":  return "Fill blank";
    default:               return t;
  }
}

export function QuestionsClient({ classes, subjects }: { classes: ClassChoice[]; subjects: SubjectChoice[] }) {
  const router = useRouter();

  // ─── Filters ─────────────────────────────────────────────────────
  // Classes is the visible-to-the-org list; "All classes" is the default
  // because the org's bank can span any class.
  const [classId, setClassId] = useState<number | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("ALL");
  const [qtype, setQtype] = useState<QType>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setOffset(0); }, [classId, selectedSubjectIds.join(","), difficulty, qtype, debouncedQuery]);
  useEffect(() => { setSelectedSubjectIds([]); }, [classId]);

  const subjectsForClass = useMemo(
    () => classId ? subjects.filter((s) => s.classId === classId) : [],
    [subjects, classId],
  );

  // ─── List ────────────────────────────────────────────────────────
  const [results, setResults] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    const ctl = new AbortController();
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (classId) params.set("classId", String(classId));
    for (const s of selectedSubjectIds) params.append("subject", String(s));
    if (difficulty !== "ALL") params.set("difficulty", difficulty);
    if (qtype !== "ALL") params.set("type", qtype);
    if (debouncedQuery) params.set("q", debouncedQuery);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    fetch(`/api/coaching/questions?${params}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setLoadError(d.error || "Couldn't load questions."); return; }
        setResults(d.data);
      })
      .catch((e) => { if (e?.name !== "AbortError") setLoadError("Couldn't reach the server."); })
      .finally(() => setLoading(false));
    return () => ctl.abort();
  }, [classId, selectedSubjectIds, difficulty, qtype, debouncedQuery, offset]);

  useEffect(() => reload(), [reload]);

  // ─── Upload ──────────────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null); setSummary(null);
    if (!file) { setUploadError("Pick a .xlsx file first."); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/coaching/questions/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) { setUploadError(data.error || "Upload failed."); return; }
      setSummary(data.data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Refresh the list so newly-imported questions appear.
      reload();
      router.refresh();
    } catch {
      setUploadError("Couldn't reach the server. Check your connection and try again.");
    } finally { setUploading(false); }
  }

  // ─── Inline preview ──────────────────────────────────────────────
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewCache, setPreviewCache] = useState<Record<number, QDetail>>({});
  const [previewLoading, setPreviewLoading] = useState<number | null>(null);

  const loadPreview = useCallback(async (qid: number) => {
    if (previewCache[qid]) { setPreviewId(qid); return; }
    setPreviewLoading(qid);
    try {
      const r = await fetch(`/api/coaching/questions/${qid}`);
      const d = await r.json();
      if (d.ok) {
        setPreviewCache((cur) => ({ ...cur, [qid]: d.data.question }));
        setPreviewId(qid);
      }
    } finally { setPreviewLoading(null); }
  }, [previewCache]);

  // ─── Render ──────────────────────────────────────────────────────
  const total = results?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = results ? offset + results.rows.length < total : false;

  return (
    <div className="mt-8 space-y-6">
      {/* Upload panel */}
      <section className="rounded-[18px] border bg-surface">
        <button
          type="button"
          onClick={() => setUploadOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-dim text-primary">
              <Upload className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium text-sm">Import questions</p>
              <p className="text-[11px] text-muted-foreground">Upload a .xlsx with up to 500 questions</p>
            </div>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", uploadOpen && "rotate-180")} />
        </button>

        {uploadOpen && (
          <form onSubmit={submitUpload} className="px-5 pb-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/api/coaching/questions/template"
                download
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download template
              </a>
              <span className="text-[11px] text-muted-foreground">
                Columns: subject_id · type · difficulty · question_text · option_a–d · correct_answer · explanation · marks
              </span>
            </div>

            <div>
              <Label htmlFor="upload-file">Spreadsheet</Label>
              <Input
                id="upload-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
                className="h-10 bg-surface-hi/30 mt-1"
              />
              {file && (
                <p className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3 w-3" />
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

            <Button type="submit" disabled={!file || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
              {uploading ? "Importing…" : "Import"}
            </Button>

            {summary && (
              <div className="rounded-[12px] border bg-surface-hi/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span><span className="font-medium text-foreground">{summary.imported}</span> imported</span>
                  {summary.skipped > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-yellow-500">{summary.skipped} skipped</span>
                    </>
                  )}
                </div>
                {summary.errors.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Show {summary.errors.length} {summary.errors.length === 1 ? "error" : "errors"}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {summary.errors.slice(0, 25).map((e, i) => (
                        <li key={i} className="text-destructive">
                          Row {e.row}: {e.message}
                        </li>
                      ))}
                      {summary.errors.length > 25 && (
                        <li className="text-muted-foreground">…and {summary.errors.length - 25} more</li>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </form>
        )}
      </section>

      {/* Filters */}
      <section className="rounded-[14px] border bg-surface p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="qf-class">Class</Label>
            <select
              id="qf-class"
              value={classId ?? ""}
              onChange={(e) => setClassId(Number(e.target.value) || null)}
              className="w-full h-10 rounded-md border bg-surface-hi/30 px-3 text-sm"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="qf-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="qf-search"
                placeholder="Find a question…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-10 pl-9 bg-surface-hi/30"
              />
            </div>
          </div>
        </div>

        {subjectsForClass.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Subjects</p>
            <div className="flex flex-wrap gap-1.5">
              {subjectsForClass.map((s) => {
                const on = selectedSubjectIds.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() =>
                      setSelectedSubjectIds((cur) =>
                        on ? cur.filter((x) => x !== s.id) : [...cur, s.id],
                      )
                    }
                    className={cn(
                      "text-xs rounded-full border px-3 py-1 transition-colors",
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-surface-hi/30 text-foreground/90 border-border hover:border-primary/40",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="qf-diff">Difficulty</Label>
            <select
              id="qf-diff"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full h-10 rounded-md border bg-surface-hi/30 px-3 text-sm"
            >
              <option value="ALL">All</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="qf-type">Type</Label>
            <select
              id="qf-type"
              value={qtype}
              onChange={(e) => setQtype(e.target.value as QType)}
              className="w-full h-10 rounded-md border bg-surface-hi/30 px-3 text-sm"
            >
              <option value="ALL">All</option>
              <option value="SINGLE_MCQ">Single MCQ</option>
              <option value="MULTI_MCQ">Multi MCQ</option>
              <option value="FILL_IN_BLANK">Fill in blank</option>
            </select>
          </div>
        </div>
      </section>

      {/* Results */}
      <section>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>
            {results ? (
              <>{total.toLocaleString()} {total === 1 ? "question" : "questions"}{total > 0 && <> · showing {Math.min(offset + 1, total)}–{Math.min(offset + results.rows.length, total)}</>}</>
            ) : (
              <Skeleton className="inline-block h-3 w-32" />
            )}
          </span>
        </div>

        {loadError ? (
          <div className="rounded-[14px] border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button type="button" onClick={() => reload()} className="text-xs underline hover:no-underline">Retry</button>
          </div>
        ) : loading && !results ? (
          <div className="rounded-[14px] border bg-surface divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-full max-w-[60%]" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : results && results.rows.length === 0 ? (
          total === 0 && !classId && selectedSubjectIds.length === 0 && difficulty === "ALL" && qtype === "ALL" && !debouncedQuery ? (
            <EmptyState
              icon={Database}
              title="No questions yet."
              body="Download the template, fill it in with your questions, and upload it. Up to 500 questions per file."
            />
          ) : (
            <div className="rounded-[14px] border bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
              No questions match these filters. Try clearing one.
            </div>
          )
        ) : results ? (
          <div className="rounded-[14px] border bg-surface divide-y">
            {results.rows.map((q) => {
              const open = previewId === q.id;
              const detail = previewCache[q.id];
              return (
                <div key={q.id}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{q.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        <span className="uppercase tracking-widest">{q.subjectName ?? "—"}</span>
                        <span>·</span>
                        <span className={cn("rounded-full px-2 py-0.5 font-medium uppercase tracking-widest", diffBadge(q.difficulty))}>
                          {q.difficulty}
                        </span>
                        <span>·</span>
                        <span>{typeLabel(q.type)}</span>
                        <span>·</span>
                        <span>{q.optionCount} options</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => (open ? setPreviewId(null) : loadPreview(q.id))}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
                    >
                      {previewLoading === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : open ? <X className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {open ? "Hide" : "Preview"}
                    </button>
                  </div>
                  {open && detail && (
                    <div className="px-4 pb-4 -mt-1">
                      <div className="rounded-[10px] border bg-surface-hi/20 px-4 py-3">
                        <ul className="space-y-1.5">
                          {detail.options.map((o, i) => (
                            <li key={i} className="text-xs flex items-start gap-2">
                              <span className="text-muted-foreground shrink-0">{o.label}.</span>
                              <span className={cn("flex-1", o.isCorrect && "text-primary font-medium")}>{o.text || "—"}</span>
                              {o.isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {results && total > PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              ← Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {Math.floor(offset / PAGE_SIZE) + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNext || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next →
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
