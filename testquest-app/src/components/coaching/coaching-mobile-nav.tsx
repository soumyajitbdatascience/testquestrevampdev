"use client";

/**
 * Mobile nav drawer used by CoachingHeader (Task 5.2-F1).
 *
 * Renders a hamburger button (sm:hidden) that opens a slide-in drawer with
 * full-width tap rows for every link the desktop nav surfaces. 48px min-height
 * per row, with role badge and Sign-out at the bottom.
 */
import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { coachingLogout } from "@/app/coaching/_actions/auth";

type Props = {
  orgName?: string | null;
  role?: string | null;
  showSignOut?: boolean;
  showTeamLink?: boolean;
  showTestsLink?: boolean;
  showQuestionsLink?: boolean;
  showSettingsLink?: boolean;
  showHelpLink?: boolean;
  branchCount?: number;
};

export function CoachingMobileNav({
  orgName,
  role,
  showSignOut = true,
  showTeamLink = false,
  showTestsLink = false,
  showQuestionsLink = false,
  showSettingsLink = false,
  showHelpLink = false,
  branchCount = 0,
}: Props) {
  const [open, setOpen] = useState(false);

  const rowClass =
    "flex min-h-[48px] items-center px-5 text-sm text-foreground hover:bg-muted transition-colors";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      <MobileDrawer open={open} onClose={() => setOpen(false)} title={orgName || "Menu"}>
        <nav className="flex flex-col py-2">
          {showTestsLink && (
            <Link href="/coaching/tests" className={rowClass} onClick={() => setOpen(false)}>
              Tests
            </Link>
          )}
          {showQuestionsLink && (
            <Link href="/coaching/questions" className={rowClass} onClick={() => setOpen(false)}>
              Questions
            </Link>
          )}
          {showTeamLink && (
            <Link href="/coaching/team" className={rowClass} onClick={() => setOpen(false)}>
              Team
            </Link>
          )}
          {showSettingsLink && (
            <Link
              href="/coaching/settings/branding"
              className={rowClass}
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
          )}
          {branchCount > 0 && (
            <Link href="/coaching/branches" className={rowClass} onClick={() => setOpen(false)}>
              Branches ({branchCount})
            </Link>
          )}
          {showHelpLink && (
            <Link href="/help" className={rowClass} onClick={() => setOpen(false)}>
              Help
            </Link>
          )}
          {role && (
            <div className="px-5 pt-3 pb-2">
              <span className="inline-flex items-center rounded-full bg-primary-dim text-primary px-3 py-1 text-[11px] font-medium uppercase tracking-widest">
                {role}
              </span>
            </div>
          )}
        </nav>
        {showSignOut && (
          <div className="mt-auto border-t border-border/60">
            <form action={coachingLogout}>
              <button
                type="submit"
                className="flex min-h-[48px] w-full items-center px-5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </MobileDrawer>
    </>
  );
}
