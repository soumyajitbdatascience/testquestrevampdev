"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";

/**
 * Subjects — the shared master list (8 rows).
 *
 * A subject is NOT tied to a class. "Mathematics" exists once and is reused by
 * every board and class through an Offering, so this screen has no class column
 * and no class picker. Content is managed in the offering workspace.
 */
interface SubjectRow {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  _count: { offerings: number; questions: number };
}

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [form, setForm] = useState({ name: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const url = search
      ? `/api/admin/taxonomy/subjects?search=${encodeURIComponent(search)}`
      : "/api/admin/taxonomy/subjects";
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) setSubjects(data.data);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", sortOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(s: SubjectRow) {
    setEditing(s);
    setForm({ name: s.name, sortOrder: s.sortOrder });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    const url = editing
      ? `/api/admin/taxonomy/subjects/${editing.id}`
      : "/api/admin/taxonomy/subjects";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setDialogOpen(false);
      load();
    }
  }

  async function remove(s: SubjectRow) {
    if (!confirm(`Hide "${s.name}"? It is used by ${s._count.offerings} offering(s). Content is not deleted.`)) return;
    const res = await fetch(`/api/admin/taxonomy/subjects/${s.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) load();
    else alert(data.error || "Something went wrong");
  }

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Subjects"
        subtitle="The shared subject master. A subject is reused across boards and classes via offerings."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New subject
          </Button>
        }
      />

      <div className="mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects"
          className="max-w-xs h-10"
        />
      </div>

      <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">No subjects yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Sort order</TableHead>
                <TableHead>Offerings</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.sortOrder}</TableCell>
                  <TableCell>{s._count.offerings}</TableCell>
                  <TableCell>{s._count.questions.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "success" : "secondary"}>
                      {s.isActive ? "Active" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(s)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit subject" : "Create subject"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update subject" : "Add a subject to the shared master list"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input id="sortOrder" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
