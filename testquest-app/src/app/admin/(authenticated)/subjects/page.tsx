"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";

interface SubjectRow {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  class: { id: number; name: string };
  _count: { chapters: number; tests: number };
}

interface ClassOption { id: number; name: string }

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [filterClassId, setFilterClassId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [form, setForm] = useState({ name: "", classId: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const url = filterClassId
      ? `/api/admin/taxonomy/subjects?classId=${filterClassId}`
      : "/api/admin/taxonomy/subjects";
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) setSubjects(data.data);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/admin/taxonomy/classes")
      .then((r) => r.json())
      .then((d) => d.ok && setClasses(d.data));
  }, []);

  useEffect(() => { load(); }, [filterClassId]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", classId: filterClassId, sortOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(s: SubjectRow) {
    setEditing(s);
    setForm({ name: s.name, classId: String(s.class.id), sortOrder: s.sortOrder });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    const body = {
      name: form.name,
      classId: Number(form.classId),
      sortOrder: form.sortOrder,
    };
    const url = editing
      ? `/api/admin/taxonomy/subjects/${editing.id}`
      : "/api/admin/taxonomy/subjects";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setDialogOpen(false);
      load();
    }
  }

  async function remove(s: SubjectRow) {
    if (!confirm(`Delete "${s.name}"?`)) return;
    const res = await fetch(`/api/admin/taxonomy/subjects/${s.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) load();
    else alert(data.error);
  }

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Subjects"
        subtitle="Subjects within each class"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New subject
          </Button>
        }
      />

      <div className="mb-4">
        <Select value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)} className="max-w-xs h-10">
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
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
                <TableHead>Class</TableHead>
                <TableHead>Sort order</TableHead>
                <TableHead>Chapters</TableHead>
                <TableHead>Tests</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="secondary">{s.class.name}</Badge></TableCell>
                  <TableCell>{s.sortOrder}</TableCell>
                  <TableCell>{s._count.chapters}</TableCell>
                  <TableCell>{s._count.tests}</TableCell>
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
            <DialogDescription>{editing ? "Update subject" : "Add a new subject to a class"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classId">Class</Label>
              <Select id="classId" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input id="sortOrder" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.classId}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
