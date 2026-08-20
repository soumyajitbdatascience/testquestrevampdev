"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, ChevronUp, ChevronDown, Check, X, Pencil, Trash2, ListTree } from "lucide-react";

/**
 * Chapters tab — the offering's syllabus order.
 *
 * Pre-scoped to the offering, so there are no board/class/subject pickers to
 * re-answer on every visit. Inline rename (Enter commits, Esc cancels) and
 * up/down reordering keep a content author on the keyboard.
 */
interface Chapter {
  id: number;
  name: string;
  sortOrder: number;
  legacyId: number | null;
  counts: { questions: number; videos: number; tests: number };
}

export function ChaptersTab({ offeringId, onChanged }: { offeringId: number; onChanged?: () => void }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `loading` starts true, so nothing is set synchronously inside the effect.
  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/offerings/${offeringId}/chapters`);
    const data = await res.json();
    if (data.ok) setChapters(data.data);
    setLoading(false);
  }, [offeringId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/admin/offerings/${offeringId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.ok) { setNewName(""); load(); onChanged?.(); }
    else setError(data.error || "Could not add that chapter");
  }

  async function rename(id: number) {
    if (!editName.trim()) { setEditingId(null); return; }
    setBusy(true);
    const res = await fetch(`/api/admin/offerings/${offeringId}/chapters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    const data = await res.json();
    setBusy(false);
    setEditingId(null);
    if (data.ok) load(); else setError(data.error || "Could not rename that chapter");
  }

  async function remove(c: Chapter) {
    if (!confirm(`Archive "${c.name}"? Content already tagged to it is kept.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/offerings/${offeringId}/chapters/${c.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) { load(); onChanged?.(); }
    else setError(data.error || "Could not archive that chapter");
  }

  /** Optimistic swap, then persist the whole order. */
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[target]] = [next[target], next[index]];
    setChapters(next);
    setBusy(true);
    const res = await fetch(`/api/admin/offerings/${offeringId}/chapters`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((c) => c.id) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { setError(data.error || "Could not save that order"); load(); }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") create(); }}
          placeholder="Add a chapter, e.g. Number System"
          className="h-10 max-w-md"
        />
        <Button onClick={create} disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add chapter
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {chapters.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-16 text-center">
          <ListTree className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No chapters yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first chapter above — questions and videos hang off these.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-[13px]">
            <thead className="border-b bg-surface-hi/50 text-left text-muted-foreground">
              <tr>
                <th className="w-16 px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Chapter</th>
                <th className="w-24 px-3 py-2 text-right font-medium">Questions</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Tests</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Videos</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c, i) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-surface-hi/40">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0 || busy}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-25"
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === chapters.length - 1 || busy}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-25"
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {editingId === c.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") rename(c.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-8 max-w-sm"
                        />
                        <Button size="sm" variant="ghost" onClick={() => rename(c.id)}><Check className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <button
                        className="text-left font-medium hover:text-primary"
                        onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                        title="Rename"
                      >
                        {c.name}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.counts.questions > 0 ? (
                      <Link
                        href={`/admin/offerings/${offeringId}?tab=questions&chapterId=${c.id}`}
                        className="tabular-nums hover:text-primary hover:underline"
                      >
                        {c.counts.questions.toLocaleString()}
                      </Link>
                    ) : (
                      <Badge variant="warning" className="text-[10px]">none</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.counts.tests}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.counts.videos}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(c.id); setEditName(c.name); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
