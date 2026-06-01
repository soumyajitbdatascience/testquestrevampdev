"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Reset failed");
        return;
      }
      router.push("/login?reset=success");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-6">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display tracking-tight">Invalid link.</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          This reset link is missing or malformed. Request a new one to continue.
        </p>
        <Button asChild className="w-full mt-8 h-11">
          <Link href="/forgot-password">
            Request a new link
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl md:text-4xl font-display tracking-tight">Set a new password.</h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        Pick a strong password you'll remember.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
            className="h-11"
            placeholder="At least 6 characters"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            disabled={loading}
            className="h-11"
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Reset password
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-6">
          <Link href="/">
            <Logo />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/login"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="ml-1">Back to sign in</span>
          </Link>
          <Suspense fallback={<div>Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
