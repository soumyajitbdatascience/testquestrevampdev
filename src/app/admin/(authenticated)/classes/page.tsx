"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";

interface BoardChip {
  id: number;
  code: string;
  name: string;
}

interface ClassRow {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  legacyId: number | null;
  /** Boards that offer this class (tq_board_classes). */
  boards: BoardChip[];
  _count: { offerings: number };
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState({ name: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/taxonomy/classes");
    const data = await res.json();
    if (data.ok) setClasses(data.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", sortOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(cls: ClassRow) {
    setEditing(cls);
    setForm({ name: cls.name, sortOrder: cls.sortOrder });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    const url = editing
      ? `/api/admin/taxonomy/classes/${editing.id}`
      : "/api/admin/taxonomy/classes";
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

  async function remove(cls: ClassRow) {
    if (!confirm(`Hide "${cls.name}"? It has ${cls._count.offerings} offering(s). Content is not deleted.`)) {
      return;
    }
    const res = await fetch(`/api/admin/taxonomy/classes/${cls.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) load();
    else alert(data.error || "Could not delete");
  }

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Classes"
        subtitle="The shared class master. A class is board-agnostic — boards offer it."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New class
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : classes.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">No classes yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Sort order</TableHead>
                <TableHead>Offered by</TableHead>
                <TableHead>Offerings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.sortOrder}</TableCell>
                  <TableCell>
                    {c.boards.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Not offered yet</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {c.boards.map((b) => (
                          <Badge key={b.id} variant="secondary" className="text-[10px]" title={b.name}>
                            {b.code}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{c._count.offerings}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "success" : "secondary"}>
                      {c.isActive ? "Active" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(c)}
                      className="text-destructive hover:text-destructive"
                    >
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
            <DialogTitle>{editing ? "Edit class" : "Create class"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update class details" : "Add a new class level"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Class 10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
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
