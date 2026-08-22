"use client";

/**
 * Task 5.4 — banner shown above the OnboardingTip whenever the org still
 * has sample data loaded. Single button DELETEs the demo batch + fake
 * students + sample assignment via /api/coaching/sample-data.
 *
 * The dashboard server-component fetches `hasSampleData` and decides whether
 * to mount this — we don't poll. After a successful delete we router.refresh()
 * so the dashboard re-renders without the demo batch and without this banner.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";

export function SampleDataBanner() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    start(async () => {
      try {
        const res = await fetch("/api/coaching/sample-data", { method: "DELETE" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
          setError(body.error ?? `Couldn't delete demo data (${res.status}).`);
          return;
        }
        router.refresh();
      } catch {
        setError("Network error — please try again.");
      }
    });
  }

  return (
    <div className="mb-4 rounded-[14px] border border-dashed border-strong bg-surface/60 px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-foreground">
              Demo data is loaded — feel free to assign tests and click around.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Delete it when you&apos;re ready to bring real students in.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-[10px] border border-strong px-3 py-2 text-sm text-foreground hover:bg-white/5 disabled:opacity-50 md:self-auto"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {pending ? "Deleting…" : "Delete demo data"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-xs text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}
