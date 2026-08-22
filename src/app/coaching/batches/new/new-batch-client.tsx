"use client";

/**
 * Minimal new-batch form. Reuses `StepBatch` shape — same fields, simpler
 * shell (no wizard chrome). Posts to /api/coaching/batches.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { Button } from "@/components/ui/button";
import { StepBatch, type StepBatchValue } from "@/app/coaching/setup/steps/step-batch";

const INITIAL: StepBatchValue = { name: "", classId: null, board: "", subjects: [] };

export function NewBatchClient({ classChoices }: { classChoices: Array<{ id: number; name: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState(false);

  let submit: () => void = () => {};

  async function commit(value: StepBatchValue) {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/coaching/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: value.name,
          classId: value.classId,
          board: value.board,
          subjects: value.subjects,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Couldn't create batch"); return; }
      router.push(`/coaching/batches/${data.data.id}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally { setLoading(false); }
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 10%, transparent), transparent 62%)" }}
      />

      <CoachingHeader variant="plain" />

      <main className="relative px-6 pb-16 pt-2 lg:pt-6">
        <div className="mx-auto max-w-[600px]">
          <Link
            href="/coaching/dashboard"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to dashboard
          </Link>

          <StepBatch
            initial={INITIAL}
            classChoices={classChoices}
            loading={loading}
            onSubmit={commit}
            onValidityChange={setValid}
            registerSubmit={(fn) => { submit = fn; }}
          />

          {error && (
            <div className="mt-6 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="button"
            onClick={() => submit()}
            disabled={!valid || loading}
            className="mt-8 w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Create batch<ArrowRight className="h-4 w-4" /></>)}
          </Button>
        </div>
      </main>
    </div>
  );
}
