"use client";

/**
 * /coaching/login — sign-in for coaching centre owners + co-teachers.
 *
 * Same split-shell layout and visual tokens as src/app/login/page.tsx; only
 * the marketing column copy + the post-success redirect differ. Posts to the
 * shared /api/auth/login endpoint, which (per Task 0.3) checks for an org
 * membership and stamps orgId + orgRole into the JWT when found.
 *
 * If the resolver returns no orgRole, this account isn't part of any coaching
 * centre — show a friendly error pointing to /coaching/signup.
 */
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, Sparkles, Building2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { RotatingYantra } from "@/components/decor/rotating-yantra";
import { cn } from "@/lib/utils";

type Mode = "password" | "mobile";

function CoachingLoginForm() {
  const [mode, setMode] = useState<Mode>("password");

  return (
    <div className="mt-8">
      {/* Mode toggle (Phase 2 / Task 2.7) */}
      <div className="inline-flex rounded-[10px] border bg-surface p-0.5 text-xs">
        {(["password", "mobile"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors",
              mode === m
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "password" ? "Email & password" : "Mobile + OTP"}
          </button>
        ))}
      </div>

      {mode === "password" ? <PasswordForm /> : <MobileOtpForm />}
    </div>
  );
}

function PasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/coaching/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Sign in failed");
        return;
      }
      if (!data.data?.orgId) {
        setError(
          "This account isn't part of a coaching centre. If you're a centre owner, sign up first.",
        );
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email" type="email" placeholder="you@yourcentre.in"
          value={email} onChange={(e) => setEmail(e.target.value)}
          required disabled={loading} className="h-11 bg-surface"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password" type="password" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)}
          required disabled={loading} className="h-11 bg-surface"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold"
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Sign in<ArrowRight className="h-4 w-4" /></>)}
      </Button>
    </form>
  );
}

/**
 * Two-stage mobile + OTP form (Phase 2 / Task 2.7).
 *   stage="mobile" — collect mobile, hit /api/coaching/login/otp
 *   stage="code"   — collect 6-digit code, hit /verify, push to redirect
 *
 * Resend cooldown is 30s; we update once a second so the button label is
 * accurate without burning a re-render storm.
 */
function MobileOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [stage, setStage] = useState<"mobile" | "code">("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [audienceLabel, setAudienceLabel] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (stage === "code") codeRef.current?.focus(); }, [stage]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function requestOtp(isResend = false) {
    setError(null);
    if (mobile.replace(/\D+/g, "").length < 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/coaching/login/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json() as { ok: boolean; data?: { audienceLabel: string | null; devOtp?: string }; error?: string };
      if (!data.ok) {
        setError(data.error || "Couldn't send the code. Try again.");
        return;
      }
      setAudienceLabel(data.data?.audienceLabel ?? null);
      setDevOtp(data.data?.devOtp ?? null);
      setResendIn(30);
      if (!isResend) setStage("code");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.replace(/\D+/g, "").length < 4) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/coaching/login/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code }),
      });
      const data = await res.json() as { ok: boolean; data?: { redirect: string }; error?: string };
      if (!data.ok) {
        setError(data.error || "Couldn't verify the code.");
        return;
      }
      router.push(next || data.data?.redirect || "/coaching/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (stage === "mobile") {
    return (
      <form onSubmit={(e) => { e.preventDefault(); requestOtp(); }} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="m-mobile">Mobile number</Label>
          <Input
            id="m-mobile" type="tel" inputMode="numeric" placeholder="10-digit number"
            value={mobile} onChange={(e) => setMobile(e.target.value)}
            required disabled={loading} className="h-11 bg-surface"
          />
          <p className="text-[11px] text-muted-foreground">
            We&apos;ll text you a 6-digit code. Same number you registered with.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Send code<ArrowRight className="h-4 w-4" /></>)}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="mt-6 space-y-4">
      <div className="rounded-md border bg-surface px-3 py-2 text-xs text-muted-foreground">
        Code sent to <span className="text-foreground font-medium">{mobile}</span>
        {audienceLabel && <> · <span className="text-foreground">{audienceLabel}</span></>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="m-code">6-digit code</Label>
        <Input
          ref={codeRef}
          id="m-code" type="tel" inputMode="numeric" autoComplete="one-time-code"
          placeholder="••••••"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D+/g, "").slice(0, 6))}
          required disabled={loading} className="h-11 bg-surface tracking-[0.4em] text-center font-mono"
          maxLength={6}
        />
        {devOtp && (
          <p className="text-[11px] text-primary">Dev: {devOtp}</p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold"
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Sign in<ArrowRight className="h-4 w-4" /></>)}
      </Button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => { setStage("mobile"); setCode(""); setError(null); }}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Change number
        </button>
        <button
          type="button"
          onClick={() => requestOtp(true)}
          disabled={resendIn > 0 || loading}
          className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}

export default function CoachingLoginPage() {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2 overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow bg-glow-gold" />

      {/* Left — marketing (hidden on mobile) */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 border-r overflow-hidden">
        <RotatingYantra size={420} className="tq-yantra-position opacity-60" />
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
            <span className="text-xs text-muted-foreground border-l pl-3">For coaching centres</span>
          </Link>
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Run your centre, not the content team</span>
          </div>
          <h2 className="mt-6 font-display text-5xl xl:text-6xl leading-[1.05] text-balance">
            Welcome back,
            <br />
            <em className="text-primary">owner.</em>
          </h2>
          <p className="mt-6 text-base text-muted-foreground max-w-md leading-relaxed">
            Sign in to manage your batches, assign tests, and track student progress.
          </p>

          <div className="mt-10 inline-flex items-center gap-2.5 text-xs text-muted-foreground">
            <Building2 className="h-4 w-4 text-primary" />
            <span>Centres across India trust Testquest</span>
          </div>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Testquest. Made for Indian students.
        </p>
      </aside>

      {/* Right — form */}
      <main className="relative flex flex-col px-6 py-10 lg:p-12">
        <div className="flex items-center justify-between lg:hidden mb-8">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="absolute top-12 right-6 lg:right-12 hidden lg:block">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col justify-center max-w-sm mx-auto w-full">
          <Link href="/for-coaching-centres" className="hidden lg:inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-3 w-3" /><span className="ml-1">Back</span>
          </Link>

          <h1 className="font-display text-4xl md:text-5xl">Centre sign-in.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage your students and assignments.</p>

          <Suspense>
            <CoachingLoginForm />
          </Suspense>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            New centre?{" "}
            <Link href="/coaching/signup" className="font-medium text-primary hover:underline underline-offset-4">
              Start a 14-day trial
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
