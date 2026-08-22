"use client";

/**
 * The one student shell (handoff 1a) + the context switcher (1b).
 *
 * Every student page renders this exact header — logo · context switcher ·
 * Home / My progress / My subscriptions · theme · avatar — so the chrome never
 * changes shape as a student navigates. There used to be two shells (a legacy
 * `Dashboard/Tests/History` header and an inline context-scoped one on Home
 * only), which is why the header flipped between pages.
 *
 * Per 1a the header carries **no nav on mobile**: pages end with a two-tile
 * quick-nav instead (`MobileQuickNav` below), so the bar stays one line on a
 * 375 and the destinations sit where a thumb already is.
 *
 * Gated pages come through the `(student)` route group, whose server layout
 * already knows the contexts and passes them in — no fetch, no flash. The one
 * page outside that group is public test detail, which mounts the shell
 * directly and lets it fetch for itself; signed-out visitors get a Sign in
 * button instead of the switcher and nav.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Plus, Check, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AddClassSheet } from "@/components/student/add-class-sheet";

export interface ShellContext {
  id: number;
  boardId: number;
  boardName: string;
  boardCode: string;
  classId: number;
  className: string;
  subscribed: boolean;
  passExpiresAt: string | null;
}

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/progress", label: "My progress" },
  { href: "/my-subscriptions", label: "My subscriptions" },
];

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function StudentShell({
  contexts: initialContexts,
  activeContextId: initialActiveId,
  userName: initialUserName,
  children,
}: {
  /** Omit to make the shell fetch for itself (public pages). */
  contexts?: ShellContext[];
  activeContextId?: number | null;
  userName?: string | null;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const serverProvided = initialContexts !== undefined;

  const [contexts, setContexts] = useState<ShellContext[]>(initialContexts ?? []);
  const [activeId, setActiveId] = useState<number | null>(initialActiveId ?? null);
  const [userName, setUserName] = useState<string | null>(initialUserName ?? null);
  // null while unknown — avoids flashing "Sign in" at a signed-in student.
  const [authed, setAuthed] = useState<boolean | null>(serverProvided ? true : null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (serverProvided) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setAuthed(!!d.ok);
        if (d.ok) setUserName(d.data.name ?? null);
      })
      .catch(() => setAuthed(false));
    fetch("/api/student/contexts")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setContexts(d.data);
        setActiveId(
          d.data.find((c: ShellContext & { isPrimary: boolean }) => c.isPrimary)?.id ?? d.data[0]?.id ?? null,
        );
      })
      .catch(() => {});
  }, [serverProvided]);

  const active = contexts.find((c) => c.id === activeId) ?? null;

  /**
   * Clears the session cookie, then leaves by full page load rather than a
   * router push — every cached client payload (contexts, home, progress) is
   * scoped to the student who just left, so the next visitor must start from
   * a blank document.
   */
  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  async function switchTo(id: number) {
    if (id === activeId) { setPickerOpen(false); return; }
    setSwitching(true);
    try {
      await fetch("/api/student/contexts/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId: id }),
      });
    } finally {
      // Hard navigation to Home: a subject or result page belongs to the class
      // being switched away from, so re-rendering it in the new scope would be
      // showing the wrong class's content — the one thing scoping must prevent.
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="min-h-screen bg-bg-alt">
      <header className="sticky top-0 z-40 border-b bg-card/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center gap-3 px-4 lg:px-6">
          <Link href="/dashboard" aria-label="Home" className="flex-shrink-0">
            <LogoMark className="h-7 w-7" />
          </Link>

          {/* Context switcher pill */}
          {active && (
            <div className="relative">
              <button
                onClick={() => setPickerOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={pickerOpen}
                data-testid="context-switcher"
                className="flex h-10 items-center gap-[7px] rounded-full bg-wash px-3.5 text-[13px] font-bold text-ink"
              >
                {/* Subscribed classes get the dot; free-browsing ones don't. */}
                {active.subscribed && (
                  <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-success" aria-label="Subscribed" />
                )}
                <span className="truncate">{active.boardCode || active.boardName} · {active.className}</span>
                <ChevronDown className="h-[13px] w-[13px] flex-shrink-0 text-text-muted-2" strokeWidth={2.5} />
              </button>

              {pickerOpen && (
                <>
                  <div
                    role="menu"
                    className="absolute left-0 top-[52px] z-20 w-[300px] rounded-[14px] border bg-card p-1.5 shadow-[0_12px_32px_oklch(0.205_0.089_282.7_/_0.18)] dark:shadow-[0_12px_32px_oklch(0_0_0_/_0.4)]"
                  >
                    {contexts.map((c) => (
                      <button
                        key={c.id}
                        role="menuitem"
                        disabled={switching}
                        onClick={() => switchTo(c.id)}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                          c.id === activeId ? "bg-wash" : "hover:bg-wash",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-ink">
                            {c.boardCode || c.boardName} · {c.className}
                          </span>
                          <span
                            className={cn(
                              "mt-px block text-[11px] font-semibold",
                              c.subscribed ? "text-success" : "text-text-secondary",
                            )}
                          >
                            {c.subscribed && c.passExpiresAt
                              ? `Subscribed — till ${fmtDate(c.passExpiresAt)}`
                              : "Free browsing · 1 free test per subject"}
                          </span>
                        </span>
                        {c.id === activeId && (
                          <Check className="mt-[3px] h-4 w-4 flex-shrink-0 text-primary" strokeWidth={3} />
                        )}
                      </button>
                    ))}

                    <div className="mx-2 my-1 h-px bg-border" />

                    {/* Persistent last row — present even with one context, so
                        growth is always one tap away. */}
                    <button
                      data-testid="add-class"
                      onClick={() => { setPickerOpen(false); setAddOpen(true); }}
                      className="flex min-h-[44px] w-full items-center gap-2 rounded-[10px] px-3 text-left text-[13.5px] font-extrabold text-primary-deep transition-colors hover:bg-wash"
                    >
                      <Plus className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} /> Add a class
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Desktop nav — no mobile counterpart here by design (1a). */}
          {authed !== false && (
            <nav
              data-testid="student-nav"
              className="ml-auto mr-2 hidden items-center gap-6 text-[13.5px] lg:flex"
            >
              {NAV.map((n) => {
                const isActive = pathname === n.href || pathname.startsWith(n.href + "/");
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "transition-colors",
                      isActive ? "font-extrabold text-ink" : "font-semibold text-text-secondary hover:text-ink",
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className={cn("flex items-center gap-2", (authed === false || !active) && "ml-auto")}>
            <ThemeToggle />
            {authed === false ? (
              <Link
                href="/login"
                className="flex h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
              >
                Sign in
              </Link>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setAccountOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label="Account"
                  data-testid="account-menu-trigger"
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                >
                  <span className="flex h-[33px] w-[33px] items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                    {(userName || "S").charAt(0).toUpperCase()}
                  </span>
                </button>

                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAccountOpen(false)} />
                    <div
                      role="menu"
                      className="absolute right-0 top-12 z-20 w-[200px] rounded-[14px] border bg-card p-1.5 shadow-[0_12px_32px_oklch(0.205_0.089_282.7_/_0.18)] dark:shadow-[0_12px_32px_oklch(0_0_0_/_0.4)]"
                    >
                      {userName && (
                        <p className="truncate px-3 pb-1 pt-1.5 text-[11px] font-semibold text-text-secondary">
                          {userName}
                        </p>
                      )}
                      <Link
                        href="/profile"
                        role="menuitem"
                        onClick={() => setAccountOpen(false)}
                        className="flex min-h-[44px] items-center gap-2 rounded-[10px] px-3 text-sm font-semibold text-ink hover:bg-wash"
                      >
                        <User className="h-4 w-4 flex-shrink-0 text-text-secondary" /> Profile
                      </Link>
                      <button
                        role="menuitem"
                        onClick={signOut}
                        data-testid="sign-out"
                        className="flex min-h-[44px] w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-semibold text-error hover:bg-wash"
                      >
                        <LogOut className="h-4 w-4 flex-shrink-0" /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page dim behind the open switcher (1b) — the switcher is a context
          change, not a menu, so it earns the weight.

          It lives outside <header> on purpose: the bar's `backdrop-blur`
          establishes a containing block, so a `fixed` overlay nested inside it
          is pinned to the header's own box and dims nothing. Sitting here at
          z-30 it covers the page while the header (z-40) and its dropdown stay
          above. */}
      {pickerOpen && (
        <div
          aria-hidden
          onClick={() => setPickerOpen(false)}
          className="fixed inset-x-0 bottom-0 top-16 z-30 bg-[oklch(0.205_0.089_282.7_/_0.35)] dark:bg-[oklch(0.10_0.05_285_/_0.5)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        />
      )}

      {children}

      {/* Mounted only while open, so each open starts from a clean pick. */}
      {active && addOpen && (
        <AddClassSheet
          onClose={() => setAddOpen(false)}
          currentBoardId={active.boardId}
          heldPairs={contexts.map((c) => ({ boardId: c.boardId, classId: c.classId }))}
          onAdded={() => { window.location.href = "/dashboard"; }}
        />
      )}
    </div>
  );
}

/**
 * The mobile counterpart to the desktop nav (1a): a two-tile grid at the end
 * of a page. `Home` is absent on purpose — you are either on it or one tap
 * from it via the logo, and a tile that reloads the page you are looking at is
 * a wasted target.
 */
export function MobileQuickNav({ className }: { className?: string }) {
  return (
    <nav
      data-testid="mobile-quick-nav"
      className={cn("mt-8 grid grid-cols-2 gap-2 lg:hidden", className)}
    >
      <Link
        href="/progress"
        className="flex min-h-[44px] items-center justify-center rounded-[12px] border bg-card text-[13px] font-bold text-text-secondary"
      >
        My progress
      </Link>
      <Link
        href="/my-subscriptions"
        className="flex min-h-[44px] items-center justify-center rounded-[12px] border bg-card text-[13px] font-bold text-text-secondary"
      >
        Subscriptions
      </Link>
    </nav>
  );
}

/**
 * Secondary bar — the back arrow + page title that subject, video, test and
 * result pages used to carry in a header of their own. It sits *beneath* the
 * shell so those pages keep their context without introducing a second shell.
 */
export function SecondaryBar({
  backHref,
  backLabel = "Back",
  title,
  subtitle,
  trailing,
}: {
  backHref: string;
  backLabel?: string;
  title: string;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="border-b bg-card/60">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4 lg:px-6">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full hover:bg-wash"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[17px] font-bold text-ink">{title}</h1>
          {subtitle && <p className="truncate text-[11px] text-text-secondary">{subtitle}</p>}
        </div>
        {trailing}
      </div>
    </div>
  );
}
