"use client";

/**
 * Step 5 — Done. Summary + "Go to dashboard" CTA.
 *
 * Renders its own CTA, so the WizardShell footer is hidden for this step.
 */
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DriftingFormulas } from "@/components/decor/drifting-formulas";

export interface StepDoneProps {
  batchName: string | null;
  studentsAdded: number;
  loading: boolean;
  /** Calls the /done endpoint (clears setupProgress) then resolves. */
  finalize: () => Promise<void>;
}

export function StepDone({ batchName, studentsAdded, loading, finalize }: StepDoneProps) {
  const router = useRouter();
  async function go() {
    await finalize();
    router.push("/coaching/dashboard");
    router.refresh();
  }
  return (
    <div className="relative">
      <DriftingFormulas opacity={0.06} />
      <div className="relative space-y-8 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-gold">
          <Check className="h-6 w-6" />
        </div>

        <header>
          <p className="text-[11px] uppercase tracking-widest text-primary">All set</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl text-balance">
            You're <em className="text-primary">ready to teach.</em>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your centre is configured. Time to assign your first test.
          </p>
        </header>

        <div className="rounded-[18px] border bg-surface p-6 text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-dim text-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="h-3 w-3" />
            Summary
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground">Batch</span>
              <span className="font-medium text-foreground">{batchName ?? "—"}</span>
            </li>
            <li className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground">Students added</span>
              <span className="font-medium text-foreground">{studentsAdded}</span>
            </li>
            <li className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium text-foreground">Starter · Trial</span>
            </li>
          </ul>
        </div>

        <Button
          type="button"
          onClick={go}
          disabled={loading}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold h-12 px-7"
        >
          Go to your dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
