"use client";

/**
 * Post-payment success (design 1e): full-screen on wash, big check, the exact
 * unlock summary, pinned CTAs — continue to the item that was tapped, or
 * explore. Celebratory but quick; no blocking animation.
 */
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { safeNextPath } from "@/lib/next-param";

interface PassCard {
  orderId: number; boardName: string; className: string;
  expiresAt: string; active: boolean;
}

export default function PassSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PassSuccessInner />
    </Suspense>
  );
}

function PassSuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = Number(params.get("orderId"));
  const returnTo = safeNextPath(params.get("returnTo"), "/dashboard");
  const [pass, setPass] = useState<PassCard | null>(null);
  const [counts, setCounts] = useState<{ subjects: number; tests: number; videos: number } | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/subscriptions").then((r) => r.json()).then(async (d) => {
      if (!d.ok) return;
      const found = d.data.passes.find((p: PassCard) => p.orderId === orderId) ?? d.data.passes[0] ?? null;
      setPass(found);
    });
    fetch("/api/auth/me").then((r) => r.json()).then((d) => d.ok && setEmail(d.data.email ?? null));
    fetch("/api/student/home").then((r) => r.json()).then((d) => {
      if (d.ok && !d.data.needsOnboarding) setCounts(d.data.totals);
    });
  }, [orderId]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-wash px-6 py-10 text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-card shadow-soft">
        <Check className="h-[58px] w-[58px] text-success" strokeWidth={2.5} />
      </div>

      {pass ? (
        <>
          <h1 className="mt-6 font-display text-[26px] font-extrabold leading-tight text-ink">
            All of {pass.className}, unlocked.
          </h1>
          <p className="mt-2 max-w-sm text-sm text-text-secondary">
            {counts && (
              <>{counts.subjects} subjects · {counts.tests} tests{counts.videos > 0 && <> · {counts.videos} videos</>} · </>
            )}
            Valid till {new Date(pass.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — no auto-renewal.
          </p>
          {email && <p className="mt-1.5 text-xs text-text-secondary">Receipt sent to {email}</p>}
        </>
      ) : (
        <Loader2 className="mt-8 h-6 w-6 animate-spin text-muted-foreground" />
      )}

      <div className="mt-10 w-full max-w-sm space-y-2.5">
        <button
          onClick={() => router.push(returnTo)}
          className="h-12 w-full rounded-[14px] bg-primary font-bold text-primary-foreground shadow-[0_6px_18px_rgba(97,52,235,.35)] inline-flex items-center justify-center gap-2"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          className="h-12 w-full rounded-[14px] border bg-card font-semibold text-text-secondary"
        >
          Explore your subjects
        </button>
      </div>
    </div>
  );
}
