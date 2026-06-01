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

interface CouponRow {
  id: number;
  code: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: string | number;
  maxDiscountCap: string | number | null;
  minOrderValue: string | number;
  scope: "ALL" | "BUNDLE_ONLY" | "FIRST_TIME";
  bundleId: number | null;
  totalUsageLimit: number | null;
  perUserLimit: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  _count: { usages: number };
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FLAT",
    discountValue: 10,
    maxDiscountCap: 0,
    minOrderValue: 0,
    scope: "ALL" as "ALL" | "BUNDLE_ONLY" | "FIRST_TIME",
    totalUsageLimit: 0,
    perUserLimit: 1,
    validFrom: "",
    validUntil: "",
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/coupons");
    const data = await res.json();
    if (data.ok) setCoupons(data.data.coupons);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    const now = new Date().toISOString().slice(0, 10);
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setForm({
      code: "",
      discountType: "PERCENTAGE",
      discountValue: 10,
      maxDiscountCap: 0,
      minOrderValue: 0,
      scope: "ALL",
      totalUsageLimit: 0,
      perUserLimit: 1,
      validFrom: now,
      validUntil: future,
    });
    setDialogOpen(true);
  }

  function openEdit(c: CouponRow) {
    setEditing(c);
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      maxDiscountCap: Number(c.maxDiscountCap || 0),
      minOrderValue: Number(c.minOrderValue),
      scope: c.scope,
      totalUsageLimit: c.totalUsageLimit || 0,
      perUserLimit: c.perUserLimit,
      validFrom: c.validFrom.slice(0, 10),
      validUntil: c.validUntil.slice(0, 10),
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = {
      code: form.code,
      discountType: form.discountType,
      discountValue: form.discountValue,
      minOrderValue: form.minOrderValue,
      scope: form.scope,
      perUserLimit: form.perUserLimit,
      validFrom: new Date(form.validFrom).toISOString(),
      validUntil: new Date(form.validUntil).toISOString(),
    };
    if (form.maxDiscountCap > 0) body.maxDiscountCap = form.maxDiscountCap;
    if (form.totalUsageLimit > 0) body.totalUsageLimit = form.totalUsageLimit;

    const url = editing ? `/api/admin/coupons/${editing.id}` : "/api/admin/coupons";
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

  async function remove(c: CouponRow) {
    if (!confirm(`Deactivate coupon "${c.code}"?`)) return;
    await fetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
    load();
  }

  function formatDate(s: string) {
    return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function isExpired(s: string) {
    return new Date(s) < new Date();
  }

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Coupons"
        subtitle="Discount codes for tests and bundles"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New coupon
          </Button>
        }
      />

      {/* TODO 5.2-F4: consider a card-list view on mobile instead of horizontal scroll. */}
      <div className="rounded-2xl border bg-card shadow-soft overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : coupons.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">No coupons yet</div>
        ) : (
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Min order</TableHead>
                <TableHead>Used / Limit</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => {
                const expired = isExpired(c.validUntil);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell>
                      {c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                      {c.maxDiscountCap && c.discountType === "PERCENTAGE" && (
                        <span className="text-xs text-muted-foreground"> (max ₹{c.maxDiscountCap})</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{c.scope}</Badge></TableCell>
                    <TableCell>₹{c.minOrderValue}</TableCell>
                    <TableCell>{c._count.usages} / {c.totalUsageLimit || "∞"}</TableCell>
                    <TableCell>{formatDate(c.validUntil)}</TableCell>
                    <TableCell>
                      {!c.isActive ? <Badge variant="secondary">Disabled</Badge>
                       : expired ? <Badge variant="destructive">Expired</Badge>
                       : <Badge variant="success">Live</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(c)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "Create coupon"}</DialogTitle>
            <DialogDescription>Set discount, validity, and usage limits</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME50"
                className="font-mono"
                disabled={!!editing}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as "PERCENTAGE" | "FLAT" })}>
                  <option value="PERCENTAGE">Percentage off</option>
                  <option value="FLAT">Flat amount off</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" min="0" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} />
              </div>
            </div>

            {form.discountType === "PERCENTAGE" && (
              <div className="space-y-2">
                <Label>Max discount cap (₹, optional)</Label>
                <Input type="number" min="0" value={form.maxDiscountCap} onChange={(e) => setForm({ ...form, maxDiscountCap: Number(e.target.value) })} placeholder="0 for no cap" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Min order value (₹)</Label>
              <Input type="number" min="0" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })} />
            </div>

            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as "ALL" | "BUNDLE_ONLY" | "FIRST_TIME" })}>
                <option value="ALL">All purchases</option>
                <option value="BUNDLE_ONLY">Bundles only</option>
                <option value="FIRST_TIME">First-time buyers only</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Total uses (0 = unlimited)</Label>
                <Input type="number" min="0" value={form.totalUsageLimit} onChange={(e) => setForm({ ...form, totalUsageLimit: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Per-user limit</Label>
                <Input type="number" min="1" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valid from</Label>
                <Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valid until</Label>
                <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.code || !form.validFrom || !form.validUntil}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
