"use client";

/**
 * Unsubscribe confirmation.
 *
 * One screen, no login, no "are you sure?" gauntlet. The opt-out is applied on
 * arrival and the page reports it — asking someone to confirm twice is how you
 * turn an unsubscribe into a spam report.
 *
 * It also says plainly what still arrives, because "unsubscribed" meaning "we
 * will still email you receipts" is the kind of surprise worth pre-empting.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}

function UnsubscribeInner() {
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "done" | "invalid">("working");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const s = Number(params.get("s"));
    const t = params.get("t");
    if (!s || !t) { setState("invalid"); return; }

    fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: s, token: t }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setEmail(d.data.email); setState("done"); }
        else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-wash px-5">
      <div className="w-full max-w-[460px] rounded-[18px] border bg-card p-8 text-center shadow-soft">
        <LogoMark className="mx-auto h-9 w-9" />

        {state === "working" && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Updating your preferences…
          </p>
        )}

        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto mt-6 h-10 w-10 text-[color:var(--success)]" />
            <h1 className="mt-4 font-display text-xl font-bold text-ink">You&apos;re unsubscribed</h1>
            <p className="mt-2 text-sm text-text-secondary">
              {email ? <>We won&apos;t send <strong className="text-ink">{email}</strong> any more</> : "We won't send you any more"}{" "}
              reminders or study nudges.
            </p>
            <p className="mt-4 rounded-[12px] bg-wash p-3 text-[13px] text-text-secondary">
              You&apos;ll still get essentials — payment receipts, email verification and
              password resets. Those aren&apos;t marketing, so we can&apos;t switch them off.
            </p>
            <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
              Back to Testquest
            </Link>
          </>
        )}

        {state === "invalid" && (
          <>
            <AlertCircle className="mx-auto mt-6 h-10 w-10 text-[color:var(--error)]" />
            <h1 className="mt-4 font-display text-xl font-bold text-ink">This link isn&apos;t valid</h1>
            <p className="mt-2 text-sm text-text-secondary">
              It may have been altered in transit. You can change email preferences
              from your profile instead.
            </p>
            <Link href="/profile" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
              Open my profile
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
