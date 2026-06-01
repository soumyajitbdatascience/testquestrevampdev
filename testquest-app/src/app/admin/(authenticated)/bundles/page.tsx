"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BundleRow {
  id: number;
  name: string;
  price: string | number;
  validityDays: number;
  isActive: boolean;
  class: { id: number; name: string } | null;
  tests: { test: { id: number; name: string } }[];
  _count: { orders: number };
}

interface TestLite { id: number; name: string; price: string | number; isFree: boolean; class: { name: string }; subject: { name: string } }
interface ClassNode { id: number; name: string }

export default function AdminBundlesPage() {
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [classes, setClasses] = useState<ClassNode[]>([]);
  const [allTests, setAllTests] = useState<TestLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BundleRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: 0,
    validityDays: 90,
    classId: "",
    testIds: [] as number[],
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/bundles");
    const data = await res.json();
    if (data.ok) setBundles(data.data.bundles);
    setLoading(false);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/taxonomy/classes").then((r) => r.json()),
      fetch("/api/admin/tests?limit=500").then((r) => r.json()),
    ]).then(([c, t]) => {
      if (c.ok) setClasses(c.data);
      if (t.ok) setAllTests(t.data.tests);
    });
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", price: 0, validityDays: 90, classId: "", testIds: [] });
    setDialogOpen(true);
  }

  async function openEdit(b: BundleRow) {
    setEditing(b);
    const res = await fetch(`/api/admin/bundles/${b.id}`);
    const data = await res.json();
    if (data.ok) {
      setForm({
        name: data.data.name,
        description: data.data.description || "",
        price: Number(data.data.price),
        validityDays: data.data.validityDays,
        classId: data.data.classId ? String(data.data.classId) : "",
        testIds: data.data.tests.map((bt: { testId: number }) => bt.testId),
      });
    }
    setDialogOpen(true);
  }

  async function save() {
    if (form.testIds.length === 0) {
      alert("Add at least one test");
      return;
    }
    setSaving(true);
    const body = {
      name: form.name,
      description: form.description || undefined,
      price: form.price,
      validityDays: form.validityDays,
      classId: form.classId ? Number(form.classId) : undefined,
      testIds: form.testIds,
    };
    const url = editing ? `/api/admin/bundles/${editing.id}` : "/api/admin/bundles";
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
    } else {
      alert(data.error);
    }
  }

  async function remove(b: BundleRow) {
    if (!confirm(`Delete bundle "${b.name}"?`)) return;
    await fetch(`/api/admin/bundles/${b.id}`, { method: "DELETE" });
    load();
  }

  function toggleTest(id: number) {
    setForm((f) => ({
      ...f,
      testIds: f.testIds.includes(id) ? f.testIds.filter((x) => x !== id) : [...f.testIds, id],
    }));
  }

  const filteredTests = form.classId
    ? allTests.filter((t) => t.class.name === classes.find((c) => c.id === Number(form.classId))?.name)
    : allTests;

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Bundles"
        subtitle="Group multiple tests into time-limited bundles"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New bundle
          </Button>
        }
      />

      {/* TODO 5.2-F4: consider a card-list view on mobile instead of horizontal scroll. */}
      <div className="rounded-2xl border bg-card shadow-soft overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : bundles.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">No bundles yet</div>
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Tests</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.class ? <Badge variant="secondary">{b.class.name}</Badge> : <span className="text-muted-foreground">All</span>}</TableCell>
                  <TableCell>{b.tests.length}</TableCell>
                  <TableCell className="font-medium">₹{b.price}</TableCell>
                  <TableCell>{b.validityDays} days</TableCell>
                  <TableCell>{b._count.orders}</TableCell>
                  <TableCell>
                    <Badge variant={b.isActive ? "success" : "secondary"}>{b.isActive ? "Live" : "Hidden"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(b)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit bundle" : "Create bundle"}</DialogTitle>
            <DialogDescription>Group tests with a single price and validity period</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Bundle name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Class 10 CBSE Full Year" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Price (₹)</Label>
                  <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Validity (days)</Label>
                  <Input type="number" min="1" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Scope (optional)</Label>
                <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                  <option value="">All classes</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
            </div>

            <div className="space-y-2 border-l pl-4">
              <Label>Tests in bundle ({form.testIds.length} selected)</Label>
              <div className="border rounded-md max-h-80 overflow-y-auto divide-y">
                {filteredTests.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No tests available</div>
                ) : (
                  filteredTests.map((t) => {
                    const selected = form.testIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTest(t.id)}
                        className={cn(
                          "flex items-start gap-2 w-full text-left p-2 hover:bg-muted/50",
                          selected && "bg-primary/5"
                        )}
                      >
                        <div className={cn(
                          "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border mt-0.5",
                          selected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                        )}>
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm line-clamp-1">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground">{t.class.name} · {t.subject.name} · {t.isFree ? "Free" : `₹${t.price}`}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name || form.testIds.length === 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
