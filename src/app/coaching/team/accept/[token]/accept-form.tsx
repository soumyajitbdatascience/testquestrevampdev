"use client";

/**
 * AcceptForm — set password (or re-confirm) then land on /coaching/dashboard.
 *
 * Two slight variants:
 *   - hasExistingAccount=false: standard "set a new password" copy.
 *   - hasExistingAccount=true:  surface a note that we'll be linking this
 *     email to the centre — the password they set here becomes the password
 *     for their account.
 */
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  token: string;
  email: string;
  name: string;
  hasExistingAccount: boolean;
}

export function AcceptForm({ token, email, name, hasExistingAccount }: Props) {
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
      const res = await fetch(`/api/coaching/team/accept/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Couldn't accept this invite. Try again.");
        return;
      }
      router.push(data.data.redirect || "/coaching/dashboard");
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
        <Label>Name</Label>
        <Input value={name} disabled className="h-11 bg-surface" />
      </div>
      <div className="space-y-1">
        <Label>Email</Label>
        <Input value={email} disabled className="h-11 bg-surface" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">{hasExistingAccount ? "Set or update your password" : "Choose a password"}</Label>
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
        {hasExistingAccount && (
          <p className="text-[11px] text-muted-foreground">
            You already have a Testquest account with this email. The password you set here will replace your old one.
          </p>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full h-11">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
        {loading ? "Joining…" : "Join the centre"}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        By joining, you agree to Testquest&apos;s terms. Cancel access anytime by asking the centre owner.
      </p>
    </form>
  );
}
