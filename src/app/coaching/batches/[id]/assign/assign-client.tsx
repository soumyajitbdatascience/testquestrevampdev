"use client";

/**
 * Two-pane assign-test client.
 *
 *  Left (60%): search + subject chip filters + scrollable test list (cards).
 *  Right (40%): selected test summary + due date + instructions + notify
 *               channels + primary "Assign to N students" CTA.
 *
 * Mobile (<lg): stacks. Right pane becomes sticky bottom after a selection.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Clock, Hash, Loader2, ArrowRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PickerTest {
  id: number;
  name: string;
  className: string | null;
  subjectName: string | null;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  isFree: boolean;
  isPractice: boolean;
}

type Notify = "sms" | "email";

interface OtherBatch {
  id: number;
  name: string;
  className: string | null;
}

export function AssignClient({
  batchId, batchName, classId, batchSubjects, enrolledCount, otherBatches,
}: {
  batchId: number;
  batchName: string;
  classId: number;
  batchSubjects: string[];
  enrolledCount: number;
  otherBatches: OtherBatch[];
}) {
  const router = useRouter();

  // Filters
  const [q, setQ] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]); // empty = "all in class"
  const [tests, setTests] = useState<PickerTest[]>([]);
  const [searching, setSearching] = useState(false);

  // Selection / commit
  const [picked, setPicked] = useState<PickerTest | null>(null);
  const [dueAt, setDueAt] = useState<string>("");        // datetime-local
  const [instructions, setInstructions] = useState<string>("");
  const [notify, setNotify] = useState<Notify[]>(["sms", "email"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task 5.3.1 — bulk targets. Current batch is always implicitly included.
  const [extraBatchIds, setExtraBatchIds] = useState<number[]>([]);
  const [partialFailures, setPartialFailures] = useState<
    Array<{ batchId: number; batchName?: string | null; error: string }>
  >([]);

  const subjectPool = useMemo(() => Array.from(new Set(batchSubjects)), [batchSubjects]);

  // Fetch tests when filters change.
  useEffect(() => {
    if (!classId) return;
    setSearching(true);
    const params = new URLSearchParams();
    params.set("classId", String(classId));
    if (q.trim()) params.set("q", q.trim());
    for (const s of selectedSubjects) params.append("subject", s);
    const ctl = new AbortController();
    fetch(`/api/coaching/tests/search?${params.toString()}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTests(d.data.tests); })
      .catch(() => {})
      .finally(() => setSearching(false));
    return () => ctl.abort();
  }, [classId, q, selectedSubjects]);

  function toggleSubject(s: string) {
    setSelectedSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }
  function toggleNotify(n: Notify) {
    setNotify((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  }

  function toggleExtraBatch(id: number) {
    setExtraBatchIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function commit() {
    if (!picked) return;
    setSubmitting(true); setError(null); setPartialFailures([]);
    const batchIds = [batchId, ...extraBatchIds];
    try {
      const res = await fetch("/api/coaching/assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchIds,
          testId: picked.id,
          title: picked.name,
          instructions: instructions.trim() || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          notify,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Couldn't assign this test. Try again."); return; }
      const { successCount, failures } = data.data as {
        successCount: number;
        failures: Array<{ batchId: number; batchName?: string | null; error: string }>;
      };
      if (successCount === 0) {
        setError("No assignments were created.");
        setPartialFailures(failures);
        return;
      }
      if (failures.length > 0) {
        // Partial — keep user on page so they can see what failed.
        setPartialFailures(failures);
        return;
      }
      // Full success — redirect.
      if (batchIds.length > 1) router.push("/coaching/dashboard");
      else router.push(`/coaching/batches/${batchId}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Left — picker */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Testquest tests by name…"
              className="pl-9 h-11 bg-surface"
            />
          </div>
        </div>

        {subjectPool.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground self-center mr-1">
              Subjects:
            </span>
            {subjectPool.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSubject(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-all",
                  selectedSubjects.includes(s)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface text-foreground/90 border-border hover:border-primary/40",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {searching ? (
          <div className="rounded-[14px] border bg-surface px-6 py-12 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Searching tests…
          </div>
        ) : tests.length === 0 ? (
          <div className="rounded-[14px] border bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
            No tests match. Try removing a subject filter or clearing the search.
          </div>
        ) : (
          <div className="space-y-2.5">
            {tests.map((t) => (
              <TestCard
                key={t.id}
                test={t}
                selected={picked?.id === t.id}
                onPick={() => setPicked(t)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Right — schedule + commit */}
      <aside className="lg:sticky lg:top-6 self-start">
        <div className="rounded-[18px] border bg-surface p-5">
          {!picked ? (
            <div className="text-center py-8">
              <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground lg:block hidden">Pick a test on the left to schedule.</p>
              <p className="text-sm text-muted-foreground lg:hidden">Pick a test above to schedule.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Selected</p>
                <p className="mt-1 font-display text-lg text-foreground">{picked.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {picked.className ?? "—"}
                  {picked.subjectName && <> · {picked.subjectName}</>}
                  {" · "}{picked.questionCount} Qs · {picked.durationMinutes}m
                </p>
              </div>

              {otherBatches.length > 0 && (
                <div className="space-y-2">
                  <Label>Also assign to</Label>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary-dim px-3 py-1 text-xs text-primary"
                      title="This batch is always included."
                    >
                      <input type="checkbox" checked disabled className="h-3 w-3 accent-primary" />
                      {batchName} (this batch)
                    </span>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-md border bg-background/40 divide-y">
                    {otherBatches.map((b) => {
                      const checked = extraBatchIds.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors",
                            checked ? "bg-primary-dim/40" : "hover:bg-surface/40",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleExtraBatch(b.id)}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                          <span className="flex-1 truncate">{b.name}</span>
                          {b.className && (
                            <span className="text-[11px] text-muted-foreground">{b.className}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {extraBatchIds.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Assigning to {extraBatchIds.length + 1} batches.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="dueAt">Due (optional)</Label>
                <Input
                  id="dueAt"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="h-11 bg-background/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="instructions">Instructions (optional)</Label>
                <textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g. Bring a calculator. Closed book."
                  className="w-full rounded-md border bg-background/40 px-3 py-2 text-sm resize-y"
                />
              </div>

              <div className="space-y-2">
                <Label>Notify by</Label>
                <div className="flex flex-wrap gap-2">
                  {(["sms", "email"] as Notify[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleNotify(n)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-all",
                        notify.includes(n)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background/40 text-foreground/90 border-border hover:border-primary/40",
                      )}
                    >
                      {n.toUpperCase()}
                    </button>
                  ))}
                  <Badge variant="secondary" className="text-[10px]" title="WhatsApp lands in Phase 2">
                    WhatsApp soon
                  </Badge>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                onClick={commit}
                disabled={submitting || enrolledCount === 0}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : extraBatchIds.length > 0 ? (
                  <>
                    <Send className="h-4 w-4" />
                    Assign to {extraBatchIds.length + 1} batches
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Assign to {enrolledCount} {enrolledCount === 1 ? "student" : "students"}
                  </>
                )}
              </Button>

              {partialFailures.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-medium">
                    {partialFailures.length} {partialFailures.length === 1 ? "batch" : "batches"} could not be assigned:
                  </p>
                  <ul className="list-disc ml-5 space-y-0.5">
                    {partialFailures.map((f) => (
                      <li key={f.batchId}>
                        <span className="font-medium">{f.batchName ?? `Batch #${f.batchId}`}</span>: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {enrolledCount === 0 && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Add students to this batch first.
                </p>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function TestCard({
  test, selected, onPick,
}: { test: PickerTest; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn(
        "w-full text-left rounded-[14px] border px-4 py-3 transition-all",
        selected
          ? "border-primary bg-primary-dim shadow-gold"
          : "bg-surface border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base text-foreground truncate">{test.name}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {test.className ?? "—"}
            {test.subjectName && <> · {test.subjectName}</>}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{test.questionCount} Qs</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{test.durationMinutes}m</span>
            <span>{test.totalMarks} marks</span>
            {test.isFree && <Badge variant="secondary" className="text-[10px] bg-primary-dim text-primary">Free</Badge>}
            {test.isPractice && <Badge variant="secondary" className="text-[10px]">Practice</Badge>}
          </div>
        </div>
        <ArrowRight className={cn("h-4 w-4 flex-shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
      </div>
    </button>
  );
}
