"use client";

/**
 * Boards admin (2a Curriculum): CRUD with the 2g deactivate guard — shows the
 * live active-pass count and spells out the consequences. Never "delete".
 */
import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Loader2, PowerOff, Power } from "lucide-react";

interface BoardRow {
  id: number; name: string; code: string; sortOrder: number;
  isActive: boolean; activePasses: number;
}

export default function AdminBoardsPage() {
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BoardRow | null>(null);
  const [guard, setGuard] = useState<BoardRow | null>(null);
  const [form, setForm] = useState({ name: "", code: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/boards").then((r) => r.json()).then((d) => d.ok && setBoards(d.data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    const url = editing ? `/api/admin/boards/${editing.id}` : "/api/admin/boards";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setSaving(false);
    if (d.ok) { setDialogOpen(false); load(); }
    else alert(d.error || "Something went wrong");
  }

  async function setActive(b: BoardRow, isActive: boolean) {
    const d = await fetch(`/api/admin/boards/${b.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    }).then((r) => r.json());
    if (d.ok) { setGuard(null); load(); }
    else alert(d.error || "Something went wrong");
  }

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Boards"
        subtitle="The boards students choose in onboarding"
        action={
          <Button onClick={() => { setEditing(null); setForm({ name: "", code: "", sortOrder: boards.length + 1 }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> New board
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Active passes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boards.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell><Badge variant="secondary">{b.code}</Badge></TableCell>
                  <TableCell>{b.activePasses}</TableCell>
                  <TableCell>
                    <Badge variant={b.isActive ? "success" : "secondary"}>{b.isActive ? "Active" : "Deactivated"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(b); setForm({ name: b.name, code: b.code, sortOrder: b.sortOrder }); setDialogOpen(true); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    {b.isActive ? (
                      <Button variant="ghost" size="sm" className="text-[color:var(--warning)]" onClick={() => setGuard(b)} title="Deactivate">
                        <PowerOff className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setActive(b, true)} title="Reactivate">
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {boards.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No boards yet — students can&apos;t onboard until one exists.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit board" : "New board"}</DialogTitle>
            <DialogDescription>Shown to students in onboarding and on plans.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bname">Name</Label>
              <Input id="bname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. CBSE" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcode">Code</Label>
              <Input id="bcode" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. CBSE" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bsort">Sort order</Label>
              <Input id="bsort" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.code}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate guard (2g) */}
      <Dialog open={!!guard} onOpenChange={(o) => !o && setGuard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {guard?.name} board?</DialogTitle>
            <DialogDescription>
              {guard?.name} has <strong className="text-foreground">{guard?.activePasses} active student pass{guard?.activePasses === 1 ? "" : "es"}</strong>.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
            <li>Existing passes keep working until they expire.</li>
            <li>The board disappears from onboarding and the storefront.</li>
            <li>Its plans are hidden — no new purchases.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuard(null)}>Cancel</Button>
            <Button className="bg-[color:var(--warning)] text-white hover:opacity-90" onClick={() => guard && setActive(guard, false)}>
              Deactivate board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
