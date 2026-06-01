"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, BookOpenCheck, LogOut, User, ShoppingBag, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrgLogo } from "@/components/student/org-logo";
import { useStudentBranding } from "@/components/student/branding-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface MeData {
  id: number;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  /** Present when this student is a member of a coaching centre. */
  org?: { id: number; name: string; role: string } | null;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tests", label: "Tests", icon: BookOpenCheck },
  { href: "/my-attempts", label: "History", icon: ShoppingBag },
];

export function StudentHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<MeData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { branding } = useStudentBranding();

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => d.ok && setMe(d.data));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled
          ? "backdrop-blur-xl border-b"
          : "border-b border-transparent"
      )}
      style={{
        background: scrolled ? "oklch(0.11 0.015 265 / 0.85)" : "transparent",
      }}
    >
      {me?.org && (
        <div className="bg-primary-dim border-b border-primary/30">
          <div className="container mx-auto flex items-center gap-3 px-6 lg:px-12 py-2 text-xs">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {(branding?.displayName || me.org.name).charAt(0).toUpperCase()}
            </span>
            <span className="text-primary">
              You're a <span className="font-medium">{me.org.role.toLowerCase()}</span> of{" "}
              <span className="font-semibold text-foreground">
                {branding?.displayName || me.org.name}
              </span>
              .
            </span>
          </div>
        </div>
      )}
      <div className="container mx-auto flex h-[68px] items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-10">
          <Link href="/tests">
            <OrgLogo />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-border transition-all p-0.5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                {me?.name?.[0]?.toUpperCase() || "?"}
              </div>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border bg-surface shadow-lift z-20 overflow-hidden">
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                        {me?.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{me?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{me?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/profile"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-white/5 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      Profile
                    </Link>
                    <Link
                      href="/help"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-white/5 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      Help & FAQ
                    </Link>
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-white/5 transition-colors text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden border-t bg-surface">
        <div className="container mx-auto px-6 flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium border-b-2 transition-colors",
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
      <div>
        <h1 className="font-display text-4xl md:text-5xl tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
