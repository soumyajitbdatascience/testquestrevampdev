"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Loader2, Layers, ArrowRight, AlertTriangle, BookOpen, ClipboardList, PlaySquare, HelpCircle,
} from "lucide-react";

/**
 * Offerings hub — the shelves.
 *
 * One card per real Board + Class + Subject. Clicking one opens its workspace,
 * where all of its content lives. This replaces the old flat Class→Subject
 * browse, which showed legacy test-sets as if they were subjects.
 */
interface Offering {
  id: number;
  isActive: boolean;
  board: { id: number; name: string; code: string };
  class: { id: number; name: string; sortOrder: number };
  subject: { id: number; name: string };
  label: string;
  counts: { chapters: number; tests: number; videos: number; questions: number; emptyTests: number };
  hasFreeSample: boolean;
}

interface Option { id: number; name: string; code?: string }

export default function AdminOfferingsPage() {
  return (
    <Suspense fallback={null}>
      <AdminOfferingsPageInner />
    </Suspense>
  );
}

function AdminOfferingsPageInner() {
  // Launch Readiness deep-links here scoped to a board+class row.
  const searchParams = useSearchParams();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [boards, setBoards] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  const [fBoard, setFBoard] = useState(searchParams.get("boardId") ?? "");
  const [fClass, setFClass] = useState(searchParams.get("classId") ?? "");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ boardId: "", classId: "", subjectId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // `loading` starts true, so nothing is set synchronously inside the effect.
  const load = useCallback(async () => {
    const res = await fetch("/api/admin/offerings");
    const data = await res.json();
    if (data.ok) setOfferings(data.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/boards").then((r) => r.json()).then((d) => d.ok && setBoards(d.data));
    fetch("/api/admin/taxonomy/classes").then((r) => r.json()).then((d) => d.ok && setClasses(d.data));
    fetch("/api/admin/taxonomy/subjects").then((r) => r.json()).then((d) => d.ok && setSubjects(d.data));
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offerings.filter((o) =>
      (!fBoard || String(o.board.id) === fBoard) &&
      (!fClass || String(o.class.id) === fClass) &&
      (!q || o.label.toLowerCase().includes(q))
    );
  }, [offerings, fBoard, fClass, search]);

  // Group by board ▸ class so the shelves read like a bookcase.
  const groups = useMemo(() => {
    const map = new Map<string, { heading: string; items: Offering[] }>();
    for (const o of filtered) {
      const key = `${o.board.id}:${o.class.id}`;
      const g = map.get(key) ?? { heading: `${o.board.name} · ${o.class.name}`, items: [] };
      g.items.push(o);
      map.set(key, g);
    }
    return [...map.values()];
  }, [filtered]);

  async function create() {
    setSaving(true);
    setFormError(null);
    const res = await fetch("/api/admin/offerings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardId: Number(form.boardId),
        classId: Number(form.classId),
        subjectId: Number(form.subjectId),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setDialogOpen(false);
      setForm({ boardId: "", classId: "", subjectId: "" });
      load();
    } else {
      setFormError(data.error || "Could not create that offering");
    }
  }

  const totalReady = offerings.filter((o) => o.counts.chapters > 0 && o.counts.tests > 0 && o.hasFreeSample).length;

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Offerings"
        subtitle={
          loading
            ? "Loading shelves…"
            : `${offerings.length} shelves · ${totalReady} with chapters, tests and a free sample`
        }
        action={
          <Button onClick={() => { setFormError(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            New offering
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search offerings"
          className="h-10 max-w-xs"
        />
        <Select value={fBoard} onChange={(e) => setFBoard(e.target.value)} className="h-10 w-auto min-w-[10rem]">
          <option value="">All boards</option>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={fClass} onChange={(e) => setFClass(e.target.value)} className="h-10 w-auto min-w-[10rem]">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-16 text-center">
          <Layers className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">
            {offerings.length === 0 ? "No offerings yet" : "No offerings match those filters"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {offerings.length === 0
              ? "An offering is one Board + Class + Subject — the shelf all content sits on."
              : "Try clearing the search or filters."}
          </p>
          {offerings.length === 0 && (
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create the first offering
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <div key={g.heading}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {g.heading}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/offerings/${o.id}`}
                    className="group rounded-xl border bg-card p-4 shadow-soft transition-colors hover:border-primary/40 hover:bg-surface-hi"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{o.subject.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {o.board.code} · {o.class.name}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-1 text-center">
                      <Stat icon={BookOpen} label="Chapters" value={o.counts.chapters} />
                      <Stat icon={HelpCircle} label="Questions" value={o.counts.questions} />
                      <Stat icon={ClipboardList} label="Tests" value={o.counts.tests} />
                      <Stat icon={PlaySquare} label="Videos" value={o.counts.videos} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {o.hasFreeSample ? (
                        <Badge variant="success" className="text-[10px]">Free sample set</Badge>
                      ) : (
                        <Badge variant="warning" className="text-[10px]">No free sample</Badge>
                      )}
                      {o.counts.emptyTests > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="mr-1 h-2.5 w-2.5" />
                          {o.counts.emptyTests} empty test{o.counts.emptyTests > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {!o.isActive && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New offering</DialogTitle>
            <DialogDescription>
              Pick a board, class and subject. That combination becomes the shelf its chapters,
              tests, videos and free sample live on.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="boardId">Board</Label>
              <Select id="boardId" value={form.boardId} onChange={(e) => setForm({ ...form, boardId: e.target.value })}>
                <option value="">Select board</option>
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classId">Class</Label>
              <Select id="classId" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjectId">Subject</Label>
              <Select id="subjectId" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving || !form.boardId || !form.classId || !form.subjectId}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create offering
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return (
    <div title={label} className="rounded-lg bg-surface-hi px-1 py-1.5">
      <Icon className="mx-auto h-3 w-3 text-muted-foreground" />
      <p className={value === 0 ? "mt-0.5 text-sm text-muted-foreground" : "mt-0.5 text-sm font-medium"}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
