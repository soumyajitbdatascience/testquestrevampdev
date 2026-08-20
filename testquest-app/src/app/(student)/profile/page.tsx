"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader2, CheckCircle2, ShoppingBag, Clock, Lock } from "lucide-react";

interface Me {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  classId: number | null;
  board: string | null;
  class: { id: number; name: string } | null;
}

interface ClassOption { id: number; name: string }

interface Purchase {
  orders: Array<{
    id: number;
    itemType: string;
    finalAmount: string | number;
    status: string;
    createdAt: string;
    test: { name: string } | null;
    bundle: { name: string } | null;
  }>;
  access: {
    active: Array<{ testId: number; testName: string; subject: string; expiresAt: string | null }>;
    expired: Array<{ testId: number; testName: string; subject: string; expiredAt: string }>;
  };
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [purchases, setPurchases] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", classId: "", board: "" });

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/taxonomy").then((r) => r.json()),
      fetch("/api/student/purchases").then((r) => r.json()),
    ]).then(([m, t, p]) => {
      if (m.ok) {
        setMe(m.data);
        setForm({
          name: m.data.name || "",
          mobile: m.data.mobile || "",
          classId: m.data.classId ? String(m.data.classId) : "",
          board: m.data.board || "CBSE",
        });
      }
      if (t.ok) setClasses(t.data);
      if (p.ok) setPurchases(p.data);
      setLoading(false);
    });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const res = await fetch("/api/student/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        mobile: form.mobile || undefined,
        classId: form.classId ? Number(form.classId) : undefined,
        board: form.board || undefined,
      }),
    });
    const data = await res.json();

    if (data.ok) {
      setMe(data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Profile</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your details and view your activity.</p>
      </header>
      <div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Identity card */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border bg-surface shadow-soft p-8 text-center lg:sticky lg:top-24">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-3xl shadow-gold">
                {me.name?.[0]?.toUpperCase() || "?"}
              </div>
              <h2 className="mt-5 font-display text-2xl tracking-tight">{me.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground break-words">{me.email}</p>
              {me.class && (
                <p className="mt-4 inline-block rounded-full bg-primary-dim text-primary px-3 py-1 text-xs font-medium">
                  {me.class.name} · {me.board}
                </p>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Form */}
            <div className="rounded-2xl border bg-surface shadow-soft p-6">
              <h2 className="font-display text-2xl tracking-tight mb-1">Personal details</h2>
              <p className="text-sm text-muted-foreground mb-6">Update your info anytime</p>

              <form onSubmit={saveProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    disabled={saving}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={me.email} disabled className="h-11" />
                  <p className="text-xs text-muted-foreground">Email can't be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    disabled={saving}
                    placeholder="9876543210"
                    className="h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="classId">Class</Label>
                    <Select
                      id="classId"
                      value={form.classId}
                      onChange={(e) => setForm({ ...form, classId: e.target.value })}
                      disabled={saving}
                      className="h-11"
                    >
                      <option value="">Select</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="board">Board</Label>
                    <Select
                      id="board"
                      value={form.board}
                      onChange={(e) => setForm({ ...form, board: e.target.value })}
                      disabled={saving}
                      className="h-11"
                    >
                      <option value="CBSE">CBSE</option>
                      <option value="ICSE">ICSE</option>
                      <option value="State">State Board</option>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save changes
                  </Button>
                  {saved && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Saved
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Purchases */}
            {purchases && (
              <div className="rounded-2xl border bg-surface shadow-soft p-6">
                <h2 className="font-display text-2xl tracking-tight mb-1 flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Purchase history
                </h2>
                <p className="text-sm text-muted-foreground mb-6">All your transactions</p>

                {purchases.orders.length === 0 ? (
                  <div className="py-12 text-center">
                    <Lock className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-muted-foreground">No purchases yet</p>
                    <Button asChild className="mt-4" variant="outline">
                      <Link href="/dashboard">Find a test</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y border-t -mx-6 px-6">
                    {purchases.orders.slice(0, 10).map((o) => (
                      <div key={o.id} className="py-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{o.test?.name || o.bundle?.name}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{o.itemType}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg tracking-tight">₹{o.finalAmount}</p>
                          <span className={`text-[10px] font-medium ${
                            o.status === "PAID" ? "text-emerald-600" :
                            o.status === "FAILED" ? "text-red-600" :
                            "text-muted-foreground"
                          }`}>
                            {o.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <PoweredByTestquest />
      </div>
    </div>
  );
}
