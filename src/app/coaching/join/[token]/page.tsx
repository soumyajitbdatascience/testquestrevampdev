/**
 * /coaching/join/[token] — student-side invite landing.
 *
 * Server-component shell: resolves the token, then either renders the friendly
 * error page or the client JoinForm with the centre + batch context.
 *
 * Public route — exempted from the /coaching/* middleware guard.
 */
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { resolveInviteToken, InviteError } from "@/lib/services/invite.service";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export default async function CoachingJoinPage({ params }: Params) {
  const { token } = await params;

  let context: Awaited<ReturnType<typeof resolveInviteToken>> | null = null;
  let errMessage: string | null = null;
  try {
    context = await resolveInviteToken(token);
  } catch (e) {
    errMessage = e instanceof InviteError ? e.message : "Something went wrong.";
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 10%, transparent), transparent 62%)" }}
      />

      {/* Top bar */}
      <header className="relative">
        <div className="mx-auto max-w-[1280px] flex items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative px-6 pb-16 pt-2 lg:pt-6">
        {context ? (
          <div className="mx-auto max-w-[480px] mt-8 animate-fade-in">
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1 text-xs text-muted-foreground mb-5">
              <span className="text-primary">✦</span>
              You're invited
            </div>
            <h1 className="font-display text-3xl md:text-4xl leading-[1.1] text-balance">
              Join <em className="text-primary">{context.orgName}</em>
              <span className="block text-base text-muted-foreground mt-2 not-italic font-sans">
                Batch — {context.batchName}
              </span>
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Verify your mobile number to enroll. You'll be able to take your centre's tests right after.
            </p>

            <JoinForm token={token} centreName={context.orgName} batchName={context.batchName} />
          </div>
        ) : (
          <div className="mx-auto max-w-[480px] mt-12 text-center">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-6 font-display text-3xl md:text-4xl">Invite link not working.</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {errMessage ?? "Something went wrong."}
            </p>
            <p className="mt-6 text-sm">
              <Link href="/" className="text-primary hover:underline underline-offset-4">
                Back to home
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
