/**
 * Shared header for authenticated /coaching/* owner pages.
 *
 * - Logo links to /coaching/dashboard
 * - Optional small org-name chip after the logo (dashboard uses it)
 * - Optional role badge ("OWNER" pill)
 * - ThemeToggle
 * - "Sign out" submits the coachingLogout server action which clears the JWT
 *   cookie and redirects to /coaching/login.
 *
 * Variants:
 *   variant="bordered" (default) — 64px tall with border-b, used on
 *     dashboard / billing / batch detail / assign / monitor.
 *   variant="plain" — taller padding, no border, used on `/coaching/batches/new`
 *     style pages that want to feel lighter.
 */
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { coachingLogout } from "@/app/coaching/_actions/auth";
import { CoachingMobileNav } from "@/components/coaching/coaching-mobile-nav";

type Props = {
  orgName?: string | null;
  role?: string | null;
  variant?: "bordered" | "plain";
  showSignOut?: boolean;
  /**
   * Show the "Team" link in the nav. Surface this on the dashboard for OWNER
   * always (so they can find the invite flow), and for everyone once the
   * centre has > 1 active member. Defaults to false — pages opt in.
   */
  showTeamLink?: boolean;
  /**
   * Show the "Tests" link (Phase 2 / Task 2.2) — links to /coaching/tests.
   * On for any org member who can build/assign tests.
   */
  showTestsLink?: boolean;
  /**
   * Show the "Questions" link (Phase 2 / Task 2.3) — links to /coaching/questions.
   * On for any org member who can manage the private bank.
   */
  showQuestionsLink?: boolean;
  /**
   * Show the "Settings" link (Phase 3 / Task 3.4) — links to
   * /coaching/settings/branding. Surface for OWNER + ADMIN.
   */
  showSettingsLink?: boolean;
  /**
   * Show the "Help" link (Task 5.5) — links to /help (public FAQ + walkthrough).
   * Surfaced on the dashboard so owners always have a path out.
   */
  showHelpLink?: boolean;
  /**
   * Task 4.4 — when > 0, renders a "Branches (n)" link to /coaching/branches.
   * Caller decides visibility (OWNER/ADMIN of parent orgs only).
   */
  branchCount?: number;
};

export function CoachingHeader({
  orgName,
  role,
  variant = "bordered",
  showSignOut = true,
  showTeamLink = false,
  showTestsLink = false,
  showQuestionsLink = false,
  showSettingsLink = false,
  showHelpLink = false,
  branchCount = 0,
}: Props) {
  const isBordered = variant === "bordered";
  return (
    <header className={isBordered ? "relative border-b" : "relative"}>
      <div
        className={
          isBordered
            ? "mx-auto max-w-[1280px] h-[64px] flex items-center justify-between px-6 lg:px-10"
            : "mx-auto max-w-[1280px] flex items-center justify-between px-6 py-5 lg:px-10"
        }
      >
        <Link href="/coaching/dashboard" className="flex items-center gap-3 min-w-0">
          <Logo />
          {orgName && (
            <span className="hidden md:inline text-xs text-muted-foreground border-l pl-3 truncate max-w-[220px]">
              {orgName}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-3">
          {showTestsLink && (
            <Link
              href="/coaching/tests"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Tests
            </Link>
          )}
          {showQuestionsLink && (
            <Link
              href="/coaching/questions"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Questions
            </Link>
          )}
          {showTeamLink && (
            <Link
              href="/coaching/team"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Team
            </Link>
          )}
          {showSettingsLink && (
            <Link
              href="/coaching/settings/branding"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Settings
            </Link>
          )}
          {branchCount > 0 && (
            <Link
              href="/coaching/branches"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Branches ({branchCount})
            </Link>
          )}
          {showHelpLink && (
            <Link
              href="/help"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Help
            </Link>
          )}
          {role && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary-dim text-primary px-3 py-1 text-[11px] font-medium uppercase tracking-widest">
              {role}
            </span>
          )}
          <ThemeToggle />
          {showSignOut && (
            <form action={coachingLogout} className="hidden sm:block">
              <button
                type="submit"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </form>
          )}
          <CoachingMobileNav
            orgName={orgName}
            role={role}
            showSignOut={showSignOut}
            showTeamLink={showTeamLink}
            showTestsLink={showTestsLink}
            showQuestionsLink={showQuestionsLink}
            showSettingsLink={showSettingsLink}
            showHelpLink={showHelpLink}
            branchCount={branchCount}
          />
        </div>
      </div>
    </header>
  );
}
