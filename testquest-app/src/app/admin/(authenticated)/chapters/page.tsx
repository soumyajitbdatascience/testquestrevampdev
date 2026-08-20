"use client";

/**
 * Chapters & tagging — the workhorse (design 2b).
 * Left: chapter list (inline add, rename, archive; wash active row).
 * Right: "In chapter" / "Untagged" tabs → dense multi-select table with
 * search + filters, "Move to chapter →" with confirm count, undo toast,
 * server pagination, and a motivation counter.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { CurriculumContextBar, useCurriculumContext } from "@/components/admin/curriculum-context-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Archive, ArrowRight, Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChapterItem { id: number; name: string; sortOrder: number; testCount: number; videoCount: number }
interface TestRow {
  id: number; name: string; questionCount: number; durationMinutes: number;
  isFree: boolean; chapterId: number | null;
  elsewhere: Array<{ boardCode: string; className: string }>;
}
interface Pane { rows: TestRow[]; total: number; page: number; pageSize: number }
interface Payload { chapters: ChapterItem[]; untaggedCount: number; totalTests: number; pane: Pane }

export default function ChaptersPage() {
  const { ctx, update, complete, loaded } = useCurriculumContext(true);
  const [data, setData] = useState<Payload | null>(null);
  const [activeChapter, setActiveChapter] = useState<number | "untagged">("untagged");
  const [search, setSearch] = useState("");
  const [freeFilter, setFreeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [newChapter, setNewChapter] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!complete || !ctx) return;
    setLoading(true);
    const q = new URLSearchParams({
      boardId: String(ctx.boardId), classId: String(ctx.classId), subjectId: String(ctx.subjectId),
      page: String(page),
    });
    if (activeChapter !== "untagged") q.set("chapterId", String(activeChapter));
    if (search) q.set("search", search);
    if (freeFilter) q.set("free", freeFilter);
    fetch(`/api/admin/chapters?${q}`).then((r) => r.json()).then((d) => {
      if (d.ok) setData(d.data);
    }).finally(() => setLoading(false));
  }, [ctx, complete, activeChapter, search, freeFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(new Set()); setPage(1); }, [activeChapter, ctx?.boardId, ctx?.classId, ctx?.subjectId]);

  // "/" focuses search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function addChapter() {
    if (!ctx || !newChapter.trim()) return;
    const d = await fetch("/api/admin/chapters", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: ctx.boardId, classId: ctx.classId, subjectId: ctx.subjectId, name: newChapter.trim() }),
    }).then((r) => r.json());
    if (d.ok) { setNewChapter(""); load(); }
  }

  async function renameChapter() {
    if (!renaming) return;
    await fetch(`/api/admin/chapters/${renaming.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renaming.name }),
    });
    setRenaming(null); load();
  }

  async function archiveChapter(id: number) {
    if (!confirm("Archive this chapter? Its tests return to Untagged.")) return;
    await fetch(`/api/admin/chapters/${id}`, { method: "DELETE" });
    if (activeChapter === id) setActiveChapter("untagged");
    load();
  }

  async function moveSelected(chapterId: number) {
    if (!ctx || selected.size === 0) return;
    const ids = [...selected];
    const prevChapter = activeChapter === "untagged" ? null : activeChapter;
    const d = await fetch("/api/admin/chapters/assign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: ctx.boardId, classId: ctx.classId, subjectId: ctx.subjectId, testIds: ids, chapterId }),
    }).then((r) => r.json());
    setMovePickerOpen(false); setMoveTarget(null);
    if (!d.ok) { alert(d.error || "Move failed"); return; }
    const chapterName = data?.chapters.find((c) => c.id === chapterId)?.name ?? "chapter";
    setSelected(new Set());
    load();
    setToast({
      msg: `Moved ${ids.length} test${ids.length === 1 ? "" : "s"} to "${chapterName}"`,
      undo: async () => {
        await fetch("/api/admin/chapters/assign", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId: ctx.boardId, classId: ctx.classId, subjectId: ctx.subjectId, testIds: ids, chapterId: prevChapter }),
        });
        setToast(null); load();
      },
    });
    setTimeout(() => setToast(null), 8000);
  }

  const pane = data?.pane;
  const allSelected = !!pane && pane.rows.length > 0 && pane.rows.every((r) => selected.has(r.id));

  return (
    <div className="p-6 lg:p-10">
      <CurriculumContextBar
        ctx={ctx}
        onChange={(next) => { update(next); }}
        coverage={data && (
          <>
            {data.chapters.length} chapters · <strong className="text-ink">{data.totalTests - data.untaggedCount}/{data.totalTests} tests tagged</strong>
          </>
        )}
      />
      <AdminPageHeader title="Chapters & tagging" subtitle="Organise the subject's tests into ordered chapters" />

      {!loaded ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !complete ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Pick a board, class and subject above to start tagging.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[270px_1fr] items-start">
          {/* Chapter list */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <button
              onClick={() => setActiveChapter("untagged")}
              className={cn(
                "flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold border-l-[3px]",
                activeChapter === "untagged" ? "bg-wash border-primary text-ink" : "border-transparent hover:bg-wash/60",
              )}
            >
              Untagged
              {data && data.untaggedCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{data.untaggedCount}</span>
              )}
            </button>
            <div className="border-t">
              {data?.chapters.map((c, i) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-2 border-l-[3px] px-3 py-2.5",
                    activeChapter === c.id ? "bg-wash border-primary" : "border-transparent hover:bg-wash/60",
                  )}
                >
                  <button onClick={() => setActiveChapter(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="font-display text-xs font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>
                    {renaming?.id === c.id ? (
                      <Input
                        autoFocus
                        value={renaming.name}
                        onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") renameChapter(); if (e.key === "Escape") setRenaming(null); }}
                        onBlur={renameChapter}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                    )}
                    <span className="ml-auto text-[10px] text-text-muted-2">{c.testCount}t · {c.videoCount}v</span>
                  </button>
                  <button className="opacity-0 group-hover:opacity-100" onClick={() => setRenaming({ id: c.id, name: c.name })} title="Rename">
                    <Pencil className="h-3 w-3 text-text-muted-2" />
                  </button>
                  <button className="opacity-0 group-hover:opacity-100" onClick={() => archiveChapter(c.id)} title="Archive">
                    <Archive className="h-3 w-3 text-text-muted-2" />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t p-2">
              <Input
                value={newChapter}
                onChange={(e) => setNewChapter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addChapter()}
                placeholder="Type a chapter name… ↵ to add"
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Test pane */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2.5 border-b p-3">
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search tests…  ( / )"
                className="h-9 w-56"
              />
              <Select value={freeFilter} onChange={(e) => { setFreeFilter(e.target.value); setPage(1); }} className="h-9 w-auto">
                <option value="">Free + paid</option>
                <option value="1">Free only</option>
                <option value="0">Paid only</option>
              </Select>
              <span className="text-xs text-muted-foreground">
                {selected.size > 0 && <><strong>{selected.size} selected</strong> of {pane?.total ?? 0} filtered</>}
              </span>
              <Button
                size="sm"
                className="ml-auto"
                disabled={selected.size === 0}
                onClick={() => setMovePickerOpen(true)}
              >
                Move to chapter <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !pane || pane.rows.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                {activeChapter === "untagged" ? "Everything is tagged — nothing left here. 🎉" : "No tests in this chapter yet."}
              </div>
            ) : (
              <>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-text-muted-2">
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => {
                            const next = new Set(selected);
                            if (allSelected) pane.rows.forEach((r) => next.delete(r.id));
                            else pane.rows.forEach((r) => next.add(r.id));
                            setSelected(next);
                          }}
                        />
                      </th>
                      <th className="px-2 py-2">Test</th>
                      <th className="px-2 py-2">Qs</th>
                      <th className="px-2 py-2">Duration</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Also tagged in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pane.rows.map((r) => (
                      <tr
                        key={r.id}
                        className={cn("border-b last:border-0 cursor-pointer", selected.has(r.id) ? "bg-wash" : "hover:bg-wash/50")}
                        onClick={() => {
                          const next = new Set(selected);
                          if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                          setSelected(next);
                        }}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => {
                              const next = new Set(selected);
                              if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                              setSelected(next);
                            }}
                          />
                        </td>
                        <td className="px-2 py-2 font-medium text-ink">{r.name}</td>
                        <td className="px-2 py-2">{r.questionCount}</td>
                        <td className="px-2 py-2">{r.durationMinutes} min</td>
                        <td className="px-2 py-2">
                          <Badge variant={r.isFree ? "success" : "secondary"}>{r.isFree ? "Free" : "Paid"}</Badge>
                        </td>
                        <td className="px-2 py-2">
                          {r.elsewhere.map((e, i) => (
                            <span key={i} className="mr-1 rounded-full border px-1.5 py-0.5 text-[10px] text-text-muted-2">
                              {e.boardCode} · {e.className}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
                  <span>
                    {(pane.page - 1) * pane.pageSize + 1}–{Math.min(pane.page * pane.pageSize, pane.total)} of {pane.total}
                    {activeChapter === "untagged" && data && data.untaggedCount > 0 && (
                      <> · <strong className="text-ink">{data.untaggedCount} left</strong> in this subject</>
                    )}
                  </span>
                  <span className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pane.page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={pane.page * pane.pageSize >= pane.total} onClick={() => setPage(page + 1)}>Next</Button>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Move picker with confirm count */}
      <Dialog open={movePickerOpen} onOpenChange={setMovePickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move {selected.size} test{selected.size === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>Pick the destination chapter.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {data?.chapters.filter((c) => c.id !== activeChapter).map((c) => (
              <button
                key={c.id}
                onClick={() => setMoveTarget(c.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                  moveTarget === c.id ? "border-primary bg-wash" : "hover:bg-wash/60",
                )}
              >
                {c.name}
                {moveTarget === c.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
            {(data?.chapters.length ?? 0) === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Create a chapter first (left pane).</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovePickerOpen(false)}>Cancel</Button>
            <Button disabled={moveTarget == null} onClick={() => moveTarget != null && moveSelected(moveTarget)}>
              Move {selected.size} test{selected.size === 1 ? "" : "s"} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Undo toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-[12px] bg-ink px-4 py-3 text-sm text-white shadow-lift">
          {toast.msg}
          {toast.undo && (
            <button onClick={toast.undo} className="font-bold text-[color:#A790EA] hover:underline">Undo</button>
          )}
        </div>
      )}
    </div>
  );
}
