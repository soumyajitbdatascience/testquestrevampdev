"use client";

/**
 * Free-sample picker (design 2d): one card per subject of the context's
 * class. Set = green pill + current test + Change. Empty = LOUD warning —
 * students see no try-free test for that subject.
 */
import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { CurriculumContextBar, useCurriculumContext } from "@/components/admin/curriculum-context-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SampleRow { subjectId: number; subjectName: string; testId: number | null; testName: string | null }
interface TestOpt { id: number; name: string; questionCount: number }

export default function FreeSamplesPage() {
  const { ctx, update, loaded } = useCurriculumContext(false);
  const complete = !!ctx && ctx.boardId != null && ctx.classId != null;
  const [rows, setRows] = useState<SampleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState<SampleRow | null>(null);
  const [pickerTests, setPickerTests] = useState<TestOpt[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);

  const load = useCallback(() => {
    if (!complete || !ctx) return;
    setLoading(true);
    fetch(`/api/admin/free-samples?boardId=${ctx.boardId}&classId=${ctx.classId}`)
      .then((r) => r.json()).then((d) => d.ok && setRows(d.data)).finally(() => setLoading(false));
  }, [ctx, complete]);
  useEffect(() => { load(); }, [load]);

  async function openPicker(row: SampleRow) {
    setPicker(row); setPickerSearch(""); setPickerLoading(true);
    // The picker offers the subject's active tests (tagged or not)
    const d = await fetch(`/api/subjects/${row.subjectId}`).then((r) => r.json());
    if (d.ok) {
      const all = [...d.data.chapters.flatMap((c: { tests: TestOpt[] }) => c.tests), ...d.data.moreTests];
      setPickerTests(all);
    }
    setPickerLoading(false);
  }

  async function pick(testId: number) {
    if (!ctx || !picker) return;
    const d = await fetch("/api/admin/free-samples", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: ctx.boardId, classId: ctx.classId, subjectId: picker.subjectId, testId }),
    }).then((r) => r.json());
    if (d.ok) { setPicker(null); load(); }
    else alert(d.error || "Could not set the sample");
  }

  const filtered = pickerTests.filter((t) => t.name.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <div className="p-6 lg:p-10">
      <CurriculumContextBar
        ctx={ctx} onChange={update} showSubject={false}
        coverage={rows.length > 0 && <>samples set: <strong className="text-ink">{rows.filter((r) => r.testId).length}/{rows.length}</strong></>}
      />
      <AdminPageHeader title="Free samples" subtitle="The one try-free test students see per subject" />

      {!loaded ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !complete ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">Pick a board and class above.</div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.subjectId}
              className={cn(
                "rounded-2xl border bg-card p-5",
                !r.testId && "border-2 border-[color:var(--warning)]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-[15px] font-bold text-ink">{r.subjectName}</h3>
                {r.testId ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-[10px] font-bold text-[color:var(--success)]">
                    <Check className="h-3 w-3" /> Sample set
                  </span>
                ) : (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[color:var(--warning)]" />
                )}
              </div>
              {r.testId ? (
                <>
                  <p className="mt-2 truncate text-sm text-text-secondary">{r.testName}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => openPicker(r)}>Change</Button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-[color:var(--warning)]">
                    No free sample set — students see no try-free test for this subject.
                  </p>
                  <Button size="sm" className="mt-3" onClick={() => openPicker(r)}>Pick a sample test</Button>
                </>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <div className="col-span-full rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              No subjects in this class.
            </div>
          )}
        </div>
      )}

      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sample for {picker?.subjectName}</DialogTitle>
            <DialogDescription>Only this subject&apos;s active tests are offered.</DialogDescription>
          </DialogHeader>
          <Input value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Search…" className="h-9" />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {pickerLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No matching tests.</p>
            ) : filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => pick(t.id)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-wash"
              >
                <span className="truncate">{t.name}</span>
                <span className="text-[11px] text-text-muted-2">{t.questionCount} Qs</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
