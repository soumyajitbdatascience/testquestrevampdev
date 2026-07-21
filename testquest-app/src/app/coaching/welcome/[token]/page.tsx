/**
 * /coaching/welcome/[token] — accept the sales-led magic link.
 *
 * Server resolves the token so we can render the org + owner name without a
 * flash of loading. The client form posts to /api/coaching/welcome/[token]
 * which sets the password, signs a JWT, and returns the next URL.
 */
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { findResetToken } from "@/lib/legacy-students";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { WelcomeForm } from "./welcome-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export default async function WelcomePage({ params }: Params) {
  const { token } = await params;

  const resolved = await findResetToken(token);
  let orgName: string | null = null;
  if (resolved) {
    const ownership = await prisma.orgMembership.findFirst({
      where: { userId: resolved.studentId, role: "OWNER", isActive: true },
      include: { org: { select: { name: true } } },
    });
    orgName = ownership?.org?.name ?? null;
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
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
          {resolved ? (
            <>
              <p className="text-[11px] uppercase tracking-widest text-primary">Welcome to Testquest</p>
              <h1 className="mt-1 font-display text-3xl md:text-4xl leading-[1.1] text-balance">
                {orgName ? `Set up ${orgName}` : "Set your password"}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Hi {resolved.name}! Pick a password and we&apos;ll get you onboarded.
              </p>
              <WelcomeForm
                token={token}
                email={resolved.email}
                name={resolved.name}
                orgName={orgName}
              />
            </>
          ) : (
            <div className="rounded-[18px] border border-destructive/40 bg-destructive/10 p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <h1 className="mt-4 font-display text-2xl">Welcome link unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This link is invalid or has expired. Ask Testquest staff to send you a new one.
              </p>
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
