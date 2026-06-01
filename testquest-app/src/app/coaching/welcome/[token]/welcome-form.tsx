"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  token: string;
  email: string;
  name: string;
  orgName: string | null;
}

export function WelcomeForm({ token, email, name, orgName }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => { passRef.current?.focus(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Use at least 6 characters for your password.");
      passRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/coaching/welcome/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Couldn't accept this link. Try again.");
        return;
      }
      router.push(data.data.redirect || "/coaching/setup");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="space-y-1">
        <Label>Your name</Label>
        <Input value={name} disabled className="h-11 bg-surface" />
      </div>
      <div className="space-y-1">
        <Label>Email</Label>
        <Input value={email} disabled className="h-11 bg-surface" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Choose a password</Label>
        <Input
          id="password"
          ref={passRef}
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
          className="h-11 bg-surface"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full h-11">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
        {loading ? "Setting up…" : orgName ? `Start setting up ${orgName}` : "Continue"}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        By continuing, you agree to Testquest&apos;s terms.
      </p>
    </form>
  );
}
