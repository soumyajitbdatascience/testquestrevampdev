"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { RotatingYantra } from "@/components/decor/rotating-yantra";

export default function AdminLoginPage() {
  const router = useRouter();
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
        body: JSON.stringify({ email, password, role: "admin" }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Sign in failed"); return; }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong");
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
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <LogoMark className="h-[34px] w-[34px]" />
            <div>
              <p className="text-lg font-semibold tracking-tight leading-none">
                Test<span className="font-display italic text-primary">quest</span>
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Admin Console</p>
            </div>
          </Link>
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Staff access only</span>
          </div>
          <h2 className="mt-6 font-display text-5xl xl:text-6xl leading-[1.05] text-balance">
            Build the
            <br />
            <em className="text-primary">learning experience.</em>
          </h2>
          <p className="mt-6 text-base text-muted-foreground max-w-md leading-relaxed">
            Manage questions, assemble tests, configure pricing, and watch your platform grow.
          </p>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Testquest Admin Console
        </p>
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

          <h1 className="font-display text-4xl md:text-5xl">Admin sign in.</h1>
          <p className="mt-2 text-sm text-muted-foreground">For Testquest staff only.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="admin@testquest.in" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="h-11 bg-surface" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="h-11 bg-surface" />
            </div>

            {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>}

            <Button type="submit" className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Sign in<ArrowRight className="h-4 w-4" /></>)}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Student? Sign in here →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
