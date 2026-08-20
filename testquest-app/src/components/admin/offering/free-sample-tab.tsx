"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Gift, Check } from "lucide-react";

/**
 * Free sample tab — the one test a student can sit before paying.
 *
 * Only live tests that actually contain questions are offered as candidates:
 * the sample is the shop window, and an empty one costs a sale.
 */
interface Candidate {
  id: number;
  name: string;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  attemptCount: number;
}

export function FreeSampleTab({ offeringId, onChanged }: { offeringId: number; onChanged?: () => void }) {
  const [current, setCurrent] = useState<{ testId: number; name: string } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/admin/offerings/${offeringId}/free-test`, { signal });
      const data = await res.json();
      if (signal?.aborted) return;
      if (data.ok) {
        setCurrent(data.data.current);
        setCandidates(data.data.candidates);
      } else {
        setError(data.error || "Could not load the free sample");
      }
      setLoading(false);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError("Could not load the free sample");
      setLoading(false);
    }
  }, [offeringId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function set(testId: number | null) {
    setSaving(testId ?? "clear");
    setError(null);
    const res = await fetch(`/api/admin/offerings/${offeringId}/free-test`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId }),
    });
    const data = await res.json();
    setSaving(null);
    if (data.ok) { load(); onChanged?.(); }
    else setError(data.error || "Could not set the free sample");
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={current ? "rounded-lg bg-green-600/10 p-2" : "rounded-lg bg-amber-500/10 p-2"}>
              <Gift className={current ? "h-5 w-5 text-green-600" : "h-5 w-5 text-amber-600"} />
            </div>
            <div>
              <p className="font-medium">
                {current ? current.name : "No free sample set"}
              </p>
              <p className="text-xs text-muted-foreground">
                {current
                  ? "Students can sit this test without a pass."
                  : "Pick one below — without a sample there is nothing to try before buying."}
              </p>
            </div>
          </div>
          {current && (
            <Button variant="outline" size="sm" onClick={() => set(null)} disabled={saving === "clear"}>
              {saving === "clear" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Clear
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-16 text-center">
          <p className="font-medium">No test can be a sample yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A sample has to be a live test with questions in it. Build one on the Tests tab first.
          </p>
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
                <th className="w-32 px-3 py-2 text-right font-medium">Sample</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const isCurrent = current?.testId === c.id;
                return (
                  <tr key={c.id} className={isCurrent ? "border-b bg-primary/5 last:border-0" : "border-b last:border-0 hover:bg-surface-hi/40"}>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.questionCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.totalMarks}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.durationMinutes}</td>
                    <td className="px-3 py-2 text-right">
                      {isCurrent ? (
                        <Badge variant="success" className="text-[10px]">
                          <Check className="mr-1 h-2.5 w-2.5" />
                          current
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => set(c.id)} disabled={saving === c.id}>
                          {saving === c.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Use this
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
