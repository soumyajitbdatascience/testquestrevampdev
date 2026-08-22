"use client";

/**
 * BuilderClient — custom test builder.
 *
 * Two-column layout on desktop, stacked on mobile:
 *   Left:  filters (class / subjects / difficulty / type / search) and a
 *          paginated question list. Each row has a checkbox + "Preview"
 *          toggle that fetches options inline.
 *   Right: test metadata + sticky selected-questions tray + Save CTA.
 *
 * Saving POSTs to /api/coaching/tests; on success we land on /coaching/tests.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  Loader2,
  Save,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ClassChoice { id: number; name: string }
interface SubjectChoice { id: number; name: string; classId: number | null }

interface QuestionRow {
  id: number;
  subjectId: number | null;
  subjectName: string | null;
  text: string;
  type: "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK" | "PARAGRAPH";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  optionCount: number;
  /** Phase 2 / Task 2.4 — bank source tag. */
  source: "TESTQUEST" | "MINE";
}

interface QuestionDetail extends QuestionRow {
  options: Array<{ label: string; text: string; isCorrect: boolean }>;
}

interface SearchResult {
  rows: QuestionRow[];
  total: number;
  limit: number;
  offset: number;
}

type Difficulty = "ALL" | "EASY" | "MEDIUM" | "HARD";
type QType = "ALL" | "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK";
type Source = "ALL" | "TESTQUEST" | "MINE";

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

export function BuilderClient({ classes, subjects }: { classes: ClassChoice[]; subjects: SubjectChoice[] }) {
  const router = useRouter();

  // ─── Test metadata ───────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState<number | null>(classes[0]?.id ?? null);
  const [duration, setDuration] = useState(30);
  const [passing, setPassing] = useState(40);

  // ─── Filter state ────────────────────────────────────────────────
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("ALL");
  const [qtype, setQtype] = useState<QType>("ALL");
  const [source, setSource] = useState<Source>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input by 350ms so we don't hammer the endpoint per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset subject filter when class changes (subjects are class-scoped).
  useEffect(() => { setSelectedSubjectIds([]); setOffset(0); }, [classId]);

  const subjectsForClass = useMemo(
    () => subjects.filter((s) => s.classId === classId),
    [subjects, classId],
  );

  // ─── Search results ──────────────────────────────────────────────
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => { setOffset(0); }, [classId, selectedSubjectIds.join(","), difficulty, qtype, source, debouncedQuery]);

  useEffect(() => {
    if (!classId) return;
    const ctl = new AbortController();
    setSearching(true);
    setSearchError(null);

    const params = new URLSearchParams();
    params.set("classId", String(classId));
    for (const s of selectedSubjectIds) params.append("subject", String(s));
    if (difficulty !== "ALL") params.set("difficulty", difficulty);
    if (qtype !== "ALL") params.set("type", qtype);
    if (source !== "ALL") params.set("source", source);
    if (debouncedQuery) params.set("q", debouncedQuery);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    fetch(`/api/coaching/questions/search?${params}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setSearchError(d.error || "Couldn't load questions."); return; }
        setResults(d.data);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setSearchError("Couldn't reach the server. Check your connection.");
      })
      .finally(() => setSearching(false));

    return () => ctl.abort();
  }, [classId, selectedSubjectIds, difficulty, qtype, source, debouncedQuery, offset]);

  // ─── Selection ──────────────────────────────────────────────────
  // We store full QuestionRow objects so the tray can render without round-tripping.
  const [picked, setPicked] = useState<QuestionRow[]>([]);
  const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked]);

  function togglePick(q: QuestionRow) {
    setPicked((cur) => cur.some((p) => p.id === q.id) ? cur.filter((p) => p.id !== q.id) : [...cur, q]);
  }
  function removePick(id: number) {
    setPicked((cur) => cur.filter((p) => p.id !== id));
  }
  function movePick(id: number, dir: -1 | 1) {
    setPicked((cur) => {
      const i = cur.findIndex((p) => p.id === id);
      if (i < 0) return cur;
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = cur.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // The subject for the test as a whole defaults to the first picked
  // question's subject. The owner can still override via a dropdown if the
  // test mixes subjects.
  const [subjectIdOverride, setSubjectIdOverride] = useState<number | null>(null);
  const inferredSubjectId = picked[0]?.subjectId ?? null;
  const finalSubjectId = subjectIdOverride ?? inferredSubjectId;
  const finalSubject = subjectsForClass.find((s) => s.id === finalSubjectId);
  // Track whether the picked questions span multiple subjects so we can flag it.
  const mixedSubjects = useMemo(() => {
    const seen = new Set(picked.map((p) => p.subjectId).filter((x): x is number => x != null));
    return seen.size > 1;
  }, [picked]);

  // ─── Inline preview ──────────────────────────────────────────────
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewCache, setPreviewCache] = useState<Record<number, QuestionDetail>>({});
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

  // ─── Save ────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    if (name.trim().length < 3) { setSaveError("Give the test a name (at least 3 characters)."); return; }
    if (!classId) { setSaveError("Pick a class."); return; }
    if (!finalSubjectId) { setSaveError("Pick a subject."); return; }
    if (picked.length === 0) { setSaveError("Add at least one question."); return; }
    if (duration < 5 || duration > 360) { setSaveError("Duration must be between 5 and 360 minutes."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/coaching/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          classId,
          subjectId: finalSubjectId,
          durationMinutes: duration,
          passingPercentage: passing,
          questionIds: picked.map((p) => p.id),
        }),
      });
      const data = await res.json();
      if (!data.ok) { setSaveError(data.error || "Couldn't save the test. Try again."); return; }
      router.push("/coaching/tests");
      router.refresh();
    } catch {
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally { setSaving(false); }
  }

  // ─── Render ──────────────────────────────────────────────────────
  const total = results?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = results ? offset + results.rows.length < total : false;

  return (
    <form ref={formRef} onSubmit={save} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* LEFT: filters + question list */}
      <section className="min-w-0">
        {/* Source toggle (Phase 2 / Task 2.4) */}
        <div className="mb-3 inline-flex rounded-[10px] border bg-surface p-0.5 text-xs">
          {(["ALL", "TESTQUEST", "MINE"] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors",
                source === s
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "ALL" ? "All sources" : s === "TESTQUEST" ? "Testquest bank" : "Your bank"}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="rounded-[14px] border bg-surface p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="filter-class">Class</Label>
              <select
                id="filter-class"
                value={classId ?? ""}
                onChange={(e) => setClassId(Number(e.target.value) || null)}
                className="w-full h-10 rounded-md border bg-surface-hi/30 px-3 text-sm"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="filter-search"
                  placeholder="Find a question…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-10 pl-9 bg-surface-hi/30"
                />
              </div>
            </div>
          </div>

          {/* Subject chips */}
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

          {/* Difficulty + Type */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="filter-difficulty">Difficulty</Label>
              <select
                id="filter-difficulty"
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
              <Label htmlFor="filter-type">Type</Label>
              <select
                id="filter-type"
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
        </div>

        {/* Results */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              {results ? (
                <>{total.toLocaleString()} questions · showing {Math.min(offset + 1, total)}–{Math.min(offset + (results.rows.length), total)}</>
              ) : (
                <Skeleton className="inline-block h-3 w-32" />
              )}
            </span>
            <span>{picked.length} selected</span>
          </div>

          {searchError ? (
            <div className="rounded-[14px] border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
              {searchError}
            </div>
          ) : searching && !results ? (
            <div className="rounded-[14px] border bg-surface divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-4 rounded shrink-0 mt-1" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-full max-w-[60%]" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          ) : results && results.rows.length === 0 ? (
            <div className="rounded-[14px] border bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
              No questions match these filters. Try clearing one.
            </div>
          ) : results ? (
            <div className="rounded-[14px] border bg-surface divide-y">
              {results.rows.map((q) => {
                const isPicked = pickedIds.has(q.id);
                const open = previewId === q.id;
                const detail = previewCache[q.id];
                return (
                  <div key={q.id} className={cn("transition-colors", isPicked && "bg-primary-dim/10")}>
                    <div className="flex items-start gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => togglePick(q)}
                        className={cn(
                          "h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          isPicked ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40",
                        )}
                        aria-label={isPicked ? "Remove from test" : "Add to test"}
                      >
                        {isPicked && <Check className="h-3 w-3" />}
                      </button>
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
                          <span>·</span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 font-medium uppercase tracking-widest",
                            q.source === "MINE"
                              ? "bg-primary-dim text-primary"
                              : "bg-surface-hi text-muted-foreground",
                          )}>
                            {q.source === "MINE" ? "Your bank" : "Testquest"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => (open ? setPreviewId(null) : loadPreview(q.id))}
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
                      >
                        {previewLoading === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : open ? <ChevronDown className="h-3.5 w-3.5 rotate-180" /> : <Eye className="h-3.5 w-3.5" />}
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

          {/* Pagination */}
          {results && total > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev || searching}
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
                disabled={!hasNext || searching}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* RIGHT: metadata + selected tray */}
      <aside className="lg:sticky lg:top-6 self-start space-y-4">
        <div className="rounded-[18px] border bg-surface p-5 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="t-name">Test name</Label>
            <Input
              id="t-name"
              placeholder="Class 8 Math diagnostic"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              className="h-10 bg-surface-hi/30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="t-desc">Description (optional)</Label>
            <textarea
              id="t-desc"
              placeholder="What this test covers, instructions, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              className="w-full min-h-[72px] rounded-md border bg-surface-hi/30 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="t-duration">Duration (min)</Label>
              <Input
                id="t-duration"
                type="number"
                min={5}
                max={360}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 0)}
                disabled={saving}
                className="h-10 bg-surface-hi/30"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-passing">Passing %</Label>
              <Input
                id="t-passing"
                type="number"
                min={0}
                max={100}
                value={passing}
                onChange={(e) => setPassing(Number(e.target.value) || 0)}
                disabled={saving}
                className="h-10 bg-surface-hi/30"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="t-subject">Subject</Label>
            <select
              id="t-subject"
              value={finalSubjectId ?? ""}
              onChange={(e) => setSubjectIdOverride(Number(e.target.value) || null)}
              disabled={saving || subjectsForClass.length === 0}
              className="w-full h-10 rounded-md border bg-surface-hi/30 px-3 text-sm"
            >
              <option value="">{picked.length === 0 ? "Add a question first" : "Pick a subject"}</option>
              {subjectsForClass.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {mixedSubjects && (
              <p className="text-[11px] text-yellow-500">
                Your selection spans multiple subjects. The whole test will be tagged under the subject you pick here.
              </p>
            )}
          </div>
        </div>

        {/* Selected tray */}
        <div className="rounded-[18px] border bg-surface p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display text-base">Selected</h3>
            <span className="text-xs text-muted-foreground">{picked.length} {picked.length === 1 ? "question" : "questions"}</span>
          </div>
          {picked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tick questions on the left to add them. You can reorder them here.
            </p>
          ) : (
            <ol className="space-y-2 max-h-[360px] overflow-y-auto">
              {picked.map((q, i) => (
                <li key={q.id} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground w-5 tabular-nums">{i + 1}.</span>
                  <span className="flex-1 line-clamp-2 leading-snug">{q.text}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button type="button" onClick={() => movePick(q.id, -1)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => movePick(q.id, +1)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Move down">↓</button>
                    <button type="button" onClick={() => removePick(q.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remove">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Save */}
        <div className="rounded-[18px] border bg-surface p-5 space-y-3">
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <Button type="submit" disabled={saving || picked.length === 0} className="w-full h-11">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
            {saving ? "Saving…" : "Save test"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            You can assign this to any batch right after saving.
          </p>
        </div>
      </aside>
    </form>
  );
}
