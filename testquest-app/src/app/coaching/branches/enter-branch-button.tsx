"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function EnterBranchButton({ orgId }: { orgId: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/coaching/branches/${orgId}/enter`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error ?? "Couldn't switch.");
        setBusy(false);
        return;
      }
      window.location.assign(data.data.redirect);
    } catch {
      setErr("Couldn't reach the server.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-3 py-1.5 text-xs hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {busy ? "Entering…" : "Enter"}
      </button>
      {err && <span className="text-[10px] text-destructive">{err}</span>}
    </div>
  );
}
