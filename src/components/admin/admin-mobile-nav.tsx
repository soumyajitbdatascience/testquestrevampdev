"use client";

/**
 * Mobile app bar + drawer for /admin/* (Task 5.2-F2).
 *
 * Desktop (lg+) keeps the existing AdminSidebar. Below lg this renders:
 *   - a top bar with Logo + hamburger
 *   - a drawer containing the same nav sections + sign-out
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { adminNavSections } from "@/components/admin/admin-sidebar";

export function AdminMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.ok && setMe(d.data))
      .catch(() => {});
  }, []);

  // Close drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-surface px-4">
        <Link href="/admin" className="flex items-center gap-2.5">
          <Logo showWordmark={false} />
          <span className="font-semibold tracking-tight">
            Test<span className="font-display italic">quest</span>
            <span className="ml-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              Admin
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <MobileDrawer open={open} onClose={() => setOpen(false)} title="Admin">
        <nav className="flex flex-col py-2">
          {adminNavSections.map((section) => (
            <div key={section.label} className="mb-3">
              <p className="px-5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                {section.label}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-[48px] items-center gap-3 px-5 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-border/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Appearance</span>
            <ThemeToggle />
          </div>
          {me && (
            <div className="rounded-lg bg-surface-hi p-3">
              <p className="text-sm font-medium truncate">{me.name}</p>
              <p className="text-xs text-muted-foreground truncate">{me.email}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md border border-border/60 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </MobileDrawer>
    </>
  );
}
