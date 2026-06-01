"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function NewBranchForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/coaching/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), city: city.trim() || null }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error ?? "Couldn't create the branch.");
        setBusy(false);
        return;
      }
      router.push("/coaching/branches");
      router.refresh();
    } catch {
      setErr("Couldn't reach the server.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-[14px] border bg-surface p-6">
      <div className="space-y-1">
        <label htmlFor="branch-name" className="text-xs uppercase tracking-widest text-muted-foreground">
          Branch name
        </label>
        <input
          id="branch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={300}
          disabled={busy}
          className="w-full h-11 rounded-[10px] border bg-surface-hi/30 px-3 text-sm"
          placeholder="Aurora Tutorials — Andheri"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="branch-city" className="text-xs uppercase tracking-widest text-muted-foreground">
          City
        </label>
        <input
          id="branch-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={100}
          disabled={busy}
          className="w-full h-11 rounded-[10px] border bg-surface-hi/30 px-3 text-sm"
          placeholder="Mumbai"
        />
      </div>
      {err && (
        <div className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || name.trim().length < 2}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-4 py-2.5 text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Creating…" : "Create branch"}
      </button>
    </form>
  );
}
