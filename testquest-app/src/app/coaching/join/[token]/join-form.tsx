"use client";

/**
 * Two-step join form.
 *
 *  Stage A: name + mobile → POST /otp → SMS sent (dev: returned in response)
 *  Stage B: 6-digit OTP   → POST /verify → JWT cookie + redirect to /tests
 *
 * No popups; inline error chip + focused-field pattern (same convention as
 * /coaching/signup).
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { Field } from "@/components/coaching/field";
import { Button } from "@/components/ui/button";

type Stage = "mobile" | "otp" | "done";

export function JoinForm({ token, centreName, batchName }: { token: string; centreName: string; batchName: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("mobile");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === "otp") codeRef.current?.focus();
  }, [stage]);

  async function sendOtp(isResend = false) {
    setError(null);
    if (!isResend) {
      if (name.trim().length < 2) { setError("Please enter your full name."); nameRef.current?.focus(); return; }
      if (mobile.replace(/\D+/g, "").length < 10) { setError("Enter a valid 10-digit mobile."); mobileRef.current?.focus(); return; }
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/coaching/join/${token}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json() as { ok: boolean; data?: { sent: true; devOtp?: string }; error?: string };
      if (!data.ok) { setError(data.error || "Couldn't send code"); return; }
      setDevOtp(data.data?.devOtp ?? null);
      setStage("otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setError(null);
    if (code.replace(/\D+/g, "").length < 4) { setError("Enter the 6-digit code."); codeRef.current?.focus(); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/coaching/join/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code, name }),
      });
      const data = await res.json() as { ok: boolean; data?: { redirect: string }; error?: string };
      if (!data.ok) { setError(data.error || "Couldn't verify"); return; }
      setStage("done");
      router.push(data.data?.redirect || "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {stage === "mobile" && (
        <>
          <Field
            ref={nameRef}
            id="name"
            label="Your full name"
            value={name}
            onChange={setName}
            placeholder="Priya Raman"
            disabled={loading}
            required
          />
          <Field
            ref={mobileRef}
            id="mobile"
            label="Mobile number"
            type="tel"
            value={mobile}
            onChange={setMobile}
            placeholder="10-digit number"
            disabled={loading}
            inputMode="tel"
            hint="We'll send you a 6-digit code to verify."
            required
          />
        </>
      )}

      {stage === "otp" && (
        <>
          <p className="text-xs text-muted-foreground">
            Sent a 6-digit code to <span className="text-foreground font-mono">{mobile}</span>.
          </p>
          <Field
            ref={codeRef}
            id="code"
            label="Verification code"
            type="text"
            value={code}
            onChange={(v) => setCode(v.replace(/\D+/g, "").slice(0, 6))}
            placeholder="123456"
            disabled={loading}
            inputMode="numeric"
            required
          />
          {devOtp && (
            <div className="rounded-md bg-primary-dim border border-primary/30 px-3 py-2 text-xs text-primary flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="font-medium">Dev mode:</span>
              <span className="font-mono">{devOtp}</span>
              <span className="text-primary/70">(SMS provider not configured)</span>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {stage === "mobile" && (
        <Button
          onClick={() => sendOtp(false)}
          className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Send code<ArrowRight className="h-4 w-4" /></>)}
        </Button>
      )}

      {stage === "otp" && (
        <>
          <Button
            onClick={verify}
            className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>Verify &amp; join {centreName.length > 14 ? "" : `— ${centreName}`}<ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
          <button
            type="button"
            onClick={() => sendOtp(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Resend code
          </button>
        </>
      )}

      {stage === "done" && (
        <div className="text-sm text-foreground">
          Joined {batchName}. Redirecting…
        </div>
      )}
    </div>
  );
}
