"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

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

          {sent ? (
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-6">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-display tracking-tight">Check your inbox.</h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                If <span className="font-medium text-foreground">{email}</span> is registered, you'll receive a password reset link within a few minutes.
              </p>

              <div className="mt-6 rounded-lg bg-muted/50 border p-4 text-xs text-muted-foreground">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Didn't receive it? Check your spam folder, or try again in a few minutes.</span>
                </p>
              </div>

              <Button asChild variant="outline" className="w-full mt-8 h-11">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl md:text-4xl font-display tracking-tight">Reset your password.</h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Enter your email and we'll send you a link to set a new one.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="you@example.com"
                    className="h-11"
                  />
                </div>

                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
