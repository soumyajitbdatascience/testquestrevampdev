/**
 * /coaching/team/accept/[token] — public set-password page for invitee.
 *
 * Resolves the invite server-side so we can show org name + role copy without
 * a flash of loading state. The actual password submit goes through the
 * client form which posts to /api/coaching/team/accept/[token].
 */
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { resolveTeamInvite, TeamError } from "@/lib/services/team.service";
import { AcceptForm } from "./accept-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export default async function AcceptPage({ params }: Params) {
  const { token } = await params;

  let invite: Awaited<ReturnType<typeof resolveTeamInvite>> | null = null;
  let errMsg: string | null = null;
  try {
    invite = await resolveTeamInvite(token);
  } catch (e) {
    errMsg = e instanceof TeamError ? e.message : "We couldn't open that invite. Try again.";
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <header className="relative">
        <div className="mx-auto max-w-[1280px] flex items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative px-6 pb-16 pt-2 lg:pt-6">
        <div className="mx-auto max-w-[480px]">
          {invite ? (
            <>
              <p className="text-[11px] uppercase tracking-widest text-primary">You&apos;ve been invited</p>
              <h1 className="mt-1 font-display text-3xl md:text-4xl leading-[1.1] text-balance">
                Join {invite.orgName}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                You&apos;ll be added as a <span className="text-foreground">{invite.role.toLowerCase()}</span>.
                Set a password and you&apos;re in.
              </p>

              <AcceptForm
                token={token}
                email={invite.email}
                name={invite.name}
                hasExistingAccount={invite.hasExistingAccount}
              />
            </>
          ) : (
            <div className="rounded-[18px] border border-destructive/40 bg-destructive/10 p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <h1 className="mt-4 font-display text-2xl">Invite unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">{errMsg}</p>
              <Link
                href="/coaching/login"
                className="mt-5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Go to sign in
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
