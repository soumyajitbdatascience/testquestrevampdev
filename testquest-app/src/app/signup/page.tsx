"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { RotatingYantra } from "@/components/decor/rotating-yantra";
import { safeNextPath } from "@/lib/next-param";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "/dashboard");
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email, mobile: form.mobile || undefined,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Signup failed"); return; }
      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2 overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow bg-glow-gold" />

      <aside className="relative hidden lg:flex flex-col justify-between p-12 border-r overflow-hidden">
        <RotatingYantra size={420} className="tq-yantra-position opacity-60" />
        <div className="relative z-10"><Link href="/"><Logo /></Link></div>

        <div className="relative z-10">
          <h2 className="font-display text-5xl xl:text-6xl leading-[1.05] text-balance">
            Start your
            <br />
            <em className="text-primary">smart prep.</em>
          </h2>
          <p className="mt-6 text-base text-muted-foreground max-w-md leading-relaxed">
            Free to start. No credit card required. Just sign up and pick your first test.
          </p>

          <ul className="mt-10 space-y-3.5 max-w-sm">
            {["Free sample tests for every chapter", "Detailed solutions on paid tests", "Track your progress over time", "Cancel any time, no questions asked"].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-dim mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm text-foreground/85">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground">© {new Date().getFullYear()} Testquest. Made for Indian students.</p>
      </aside>

      <main className="relative flex flex-col px-6 py-10 lg:p-12">
        <div className="flex items-center justify-between lg:hidden mb-8">
          <Link href="/"><Logo /></Link>
          <ThemeToggle />
        </div>

        <div className="absolute top-12 right-6 lg:right-12 hidden lg:block">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col justify-center max-w-sm mx-auto w-full">
          <Link href="/" className="hidden lg:inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-3 w-3" /><span className="ml-1">Back home</span>
          </Link>

          <h1 className="font-display text-4xl md:text-5xl">Create your account.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Free forever to try. Upgrade only when you want.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={loading} placeholder="Arjun Sharma" className="h-11 bg-surface" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={loading} placeholder="you@example.com" className="h-11 bg-surface" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="mobile" type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} disabled={loading} placeholder="9876543210" className="h-11 bg-surface" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required disabled={loading} minLength={6} placeholder="At least 6 characters" className="h-11 bg-surface" />
            </div>

            {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>}

            <Button type="submit" className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Create free account<ArrowRight className="h-4 w-4" /></>)}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By signing up, you agree to our{" "}
              <Link href="/terms" className="hover:text-foreground underline-offset-4 hover:underline">Terms</Link>{" "}and{" "}
              <Link href="/privacy" className="hover:text-foreground underline-offset-4 hover:underline">Privacy Policy</Link>.
            </p>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={next !== "/dashboard" ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-primary hover:underline underline-offset-4">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
