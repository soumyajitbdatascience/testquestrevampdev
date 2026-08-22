"use client";

/**
 * /coaching/signup — centre-owner self-serve trial signup.
 *
 * Per UI_PLAN §5.1.2: centered card, max-width 480px, single column. Field
 * order is easiest → hardest so initial friction is low: centre name → owner
 * name → city → mobile → email → password → expected students.
 *
 * State conventions: inline error chip below the offending field, focus the
 * failing field on validation error, submit button shows a spinner. No alerts,
 * no popups.
 *
 * Posts to /api/coaching/signup, which on success sets the JWT cookie with
 * orgId + orgRole=OWNER. We then push to /coaching/dashboard (eventually
 * /coaching/setup once Task 1.4 ships).
 *
 * Visual tokens: parent CSS only — saffron primary, DM Serif Display for the
 * title, surface card with border, gold glow background. No new tokens.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type Form = {
  centreName: string;
  ownerName: string;
  city: string;
  mobile: string;
  email: string;
  password: string;
  expectedStudents: string; // string in state, parsed on submit
};

type FieldKey = keyof Form;

const INITIAL: Form = {
  centreName: "",
  ownerName: "",
  city: "",
  mobile: "",
  email: "",
  password: "",
  expectedStudents: "",
};

export default function CoachingSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<FieldKey | null>(null);

  // Refs so we can focus the failing field after a server-side error.
  const refs: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
    centreName:       useRef<HTMLInputElement | null>(null),
    ownerName:        useRef<HTMLInputElement | null>(null),
    city:             useRef<HTMLInputElement | null>(null),
    mobile:           useRef<HTMLInputElement | null>(null),
    email:            useRef<HTMLInputElement | null>(null),
    password:         useRef<HTMLInputElement | null>(null),
    expectedStudents: useRef<HTMLInputElement | null>(null),
  };

  function set<K extends FieldKey>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    if (fieldError === k) setFieldError(null);
    if (error) setError(null);
  }

  function clientValidate(): FieldKey | null {
    if (form.centreName.trim().length < 2) return "centreName";
    if (form.ownerName.trim().length < 2) return "ownerName";
    if (form.city.trim().length < 1) return "city";
    if (form.mobile.trim().length < 10) return "mobile";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return "email";
    if (form.password.length < 6) return "password";
    const n = Number(form.expectedStudents);
    if (!Number.isFinite(n) || n <= 0 || n > 10_000) return "expectedStudents";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const invalid = clientValidate();
    if (invalid) {
      setFieldError(invalid);
      refs[invalid].current?.focus();
      setError(humanError(invalid));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/coaching/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centreName: form.centreName.trim(),
          ownerName: form.ownerName.trim(),
          city: form.city.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          expectedStudents: Number(form.expectedStudents),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Signup failed");
        // Best-effort: map a few server errors back to fields.
        if (/email/i.test(data.error || "")) {
          setFieldError("email");
          refs.email.current?.focus();
        }
        return;
      }
      // Land authed in the setup wizard. The wizard exits to /coaching/dashboard.
      router.push("/coaching/setup");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* Background — same tokens as /for-coaching-centres */}
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 11%, transparent), transparent 62%)" }}
      />
      <div
        className="absolute bottom-[-100px] left-[-60px] w-[520px] h-[520px] pointer-events-none"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 8%, transparent), transparent 62%)" }}
      />

      {/* Top bar */}
      <header className="relative">
        <div className="mx-auto max-w-[1280px] flex items-center justify-between px-6 py-6 lg:px-12">
          <Link href="/for-coaching-centres" className="flex items-center gap-3">
            <Logo />
            <span className="hidden md:inline text-xs text-muted-foreground border-l pl-3">For coaching centres</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative px-6 pb-16 pt-2 lg:pt-6">
        <div className="mx-auto max-w-[480px]">
          <Link
            href="/for-coaching-centres"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </Link>

          <div className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1 text-xs text-muted-foreground mb-5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            14-day trial · no card required
          </div>

          <h1 className="font-display text-4xl md:text-5xl leading-[1.05] text-balance">
            Start your <em className="text-primary">14-day trial.</em>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Set up your centre in under 10 minutes. Cancel any time.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            <Field
              k="centreName" label="Centre name" placeholder="Sunrise Coaching Centre"
              form={form} set={set} refs={refs} fieldError={fieldError} loading={loading} required
            />
            <Field
              k="ownerName" label="Your name" placeholder="Your full name"
              form={form} set={set} refs={refs} fieldError={fieldError} loading={loading} required
            />
            <Field
              k="city" label="City" placeholder="Pune"
              form={form} set={set} refs={refs} fieldError={fieldError} loading={loading} required
            />
            <Field
              k="mobile" label="Mobile" type="tel" placeholder="10-digit number"
              form={form} set={set} refs={refs} fieldError={fieldError} loading={loading} required
              inputMode="tel"
            />
            <Field
              k="email" label="Email" type="email" placeholder="you@yourcentre.in"
              form={form} set={set} refs={refs} fieldError={fieldError} loading={loading} required
            />
            <Field
              k="password" label="Password" type="password" placeholder="At least 6 characters"
              form={form} set={set} refs={refs} fieldError={fieldError} loading={loading} required
            />
            <Field
              k="expectedStudents" label="Expected students" type="number" placeholder="e.g. 60"
              form={form} set={set} refs={refs} fieldError={fieldError} loading={loading} required
              inputMode="numeric"
              hint="Used to size your trial seats. Adjustable later."
            />

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
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Start trial
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/coaching/login" className="font-medium text-primary hover:underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

function humanError(k: FieldKey): string {
  switch (k) {
    case "centreName":       return "Please enter your centre name.";
    case "ownerName":        return "Please enter your name.";
    case "city":             return "Please enter your city.";
    case "mobile":           return "Please enter a valid mobile number.";
    case "email":            return "Please enter a valid email address.";
    case "password":         return "Password must be at least 6 characters.";
    case "expectedStudents": return "Please enter a valid student count.";
  }
}

function Field({
  k, label, type = "text", placeholder, hint, form, set, refs, fieldError, loading, required, inputMode,
}: {
  k: FieldKey;
  label: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  form: Form;
  set: <K extends FieldKey>(k: K, v: string) => void;
  refs: Record<FieldKey, React.RefObject<HTMLInputElement | null>>;
  fieldError: FieldKey | null;
  loading: boolean;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const isErrored = fieldError === k;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input
        ref={refs[k]}
        id={k}
        type={type}
        placeholder={placeholder}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        required={required}
        disabled={loading}
        inputMode={inputMode}
        aria-invalid={isErrored || undefined}
        className={
          "h-11 bg-surface " +
          (isErrored ? "border-destructive focus-visible:border-destructive" : "")
        }
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
