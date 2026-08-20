"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2, ClipboardList, Pencil, Trash2, ListChecks, Gift } from "lucide-react";
import { TestQuestionPicker } from "@/components/admin/offering/test-question-picker";

/**
 * Tests tab — the tests assembled on this offering.
 *
 * A test starts as a draft, gets questions from this offering's bank, and only
 * then can go live. Total marks are derived from the questions, so they are
 * shown but never typed.
 */
interface TestRow {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  totalMarks: number;
  isFree: boolean;
  isPractice: boolean;
  isActive: boolean;
  questionCount: number;
  attemptCount: number;
  isFreeSample: boolean;
}

const emptyForm = { name: "", description: "", durationMinutes: 30, isPractice: false, isFree: false };

export function TestsTab({ offeringId, onChanged }: { offeringId: number; onChanged?: () => void }) {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TestRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [pickerFor, setPickerFor] = useState<TestRow | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/offerings/${offeringId}/tests`);
    const data = await res.json();
    if (data.ok) setTests(data.data);
    else setError(data.error || "Could not load tests");
    setLoading(false);
  }, [offeringId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(t: TestRow) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      durationMinutes: t.durationMinutes,
      isPractice: t.isPractice,
      isFree: t.isFree,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const url = editing
      ? `/api/admin/offerings/${offeringId}/tests/${editing.id}`
      : `/api/admin/offerings/${offeringId}/tests`;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || null,
        durationMinutes: Number(form.durationMinutes),
        isPractice: form.isPractice,
        isFree: form.isFree,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setDialogOpen(false);
      await load();
      onChanged?.();
      if (!editing) setNotice("Test created as a draft — add questions to make it live.");
    } else {
      setError(data.error || "Could not save that test");
    }
  }

  async function toggleLive(t: TestRow) {
    setError(null);
    const res = await fetch(`/api/admin/offerings/${offeringId}/tests/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    const data = await res.json();
    if (data.ok) { load(); onChanged?.(); }
    else setError(data.error || "Could not change that test");
  }

  async function archive(t: TestRow) {
    if (!confirm(`Archive "${t.name}"? It stops being offered; attempt history is kept.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/offerings/${offeringId}/tests/${t.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) { load(); onChanged?.(); }
    else setError(data.error || "Could not archive that test");
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {tests.length} test{tests.length === 1 ? "" : "s"} ·{" "}
          {tests.filter((t) => t.isActive).length} live
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New test
        </Button>
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

      {tests.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-16 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No tests yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one, then pick its questions from this offering&apos;s bank.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New test
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-[13px]">
            <thead className="border-b bg-surface-hi/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Test</th>
                <th className="w-24 px-3 py-2 text-right font-medium">Questions</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Marks</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Minutes</th>
                <th className="w-24 px-3 py-2 text-right font-medium">Attempts</th>
                <th className="w-24 px-3 py-2 font-medium">Status</th>
                <th className="w-36 px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-surface-hi/40">
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{t.name}</span>
                      {t.isFreeSample && (
                        <Badge variant="success" className="text-[10px]">
                          <Gift className="mr-1 h-2.5 w-2.5" />
                          sample
                        </Badge>
                      )}
                      {t.isPractice && <Badge variant="secondary" className="text-[10px]">practice</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {t.questionCount === 0
                      ? <Badge variant="warning" className="text-[10px]">none</Badge>
                      : t.questionCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.totalMarks}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.durationMinutes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {t.attemptCount === 0 ? <span className="text-muted-foreground">—</span> : t.attemptCount}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleLive(t)}
                      title={t.isActive ? "Take offline" : "Make live"}
                      className="cursor-pointer"
                    >
                      <Badge variant={t.isActive ? "success" : "secondary"} className="text-[10px]">
                        {t.isActive ? "live" : "draft"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" title="Pick questions" onClick={() => setPickerFor(t)}>
                      <ListChecks className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Edit" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" title="Archive"
                      className="text-destructive hover:text-destructive"
                      onClick={() => archive(t)}
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

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit test" : "New test"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Marks are derived from the questions in the test and can't be set here."
                : "The test starts as a draft. Pick its questions next, then make it live."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Polynomials — Set 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration" type="number" min={1} max={600} value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                className="max-w-32"
              />
            </div>
            <div className="flex gap-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox" checked={form.isPractice}
                  onChange={(e) => setForm({ ...form, isPractice: e.target.checked })}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Practice test
              </label>
              {/* "Free to all" was removed: tq_tests.isFree no longer grants
                  access to anything. Every migrated row carries isFree = true,
                  so honouring it would unlock the whole catalogue — access is
                  decided by the offering's free sample or a class pass. The
                  column stays for now; nothing reads it. */}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name.trim() || !form.durationMinutes}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pickerFor && (
        <TestQuestionPicker
          offeringId={offeringId}
          test={pickerFor}
          onClose={() => setPickerFor(null)}
          onSaved={() => { setPickerFor(null); load(); onChanged?.(); }}
        />
      )}
    </div>
  );
}
