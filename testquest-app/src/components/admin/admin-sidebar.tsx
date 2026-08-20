"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  TicketPercent,
  Receipt,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Landmark,
  BadgeIndianRupee,
  CreditCard,
  Layers,
} from "lucide-react";
import { LogoMark, Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: "New" | "Legacy";
};

// Organised around three intents: what needs doing (Overview), the content
// itself (Offerings, with Curriculum setup behind it), and the business
// (Commerce, People).
//
// Offerings is the hub — chapters, questions, tests, videos and the free
// sample are all reached by opening a shelf, not from their own screens.
export const adminNavSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      // Launch readiness is the landing page — opening the admin should answer
      // "what do I do next?" before anything else.
      { href: "/admin", label: "Launch readiness", icon: Rocket, exact: true, badge: "New" },
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    // The hub. Chapters, questions, tests, videos and the free sample all live
    // inside an offering's workspace now, not as standalone screens.
    label: "Offerings",
    items: [
      { href: "/admin/offerings", label: "All offerings", icon: Layers, badge: "New" },
    ],
  },
  {
    label: "Curriculum setup",
    items: [
      { href: "/admin/boards", label: "Boards", icon: Landmark },
      { href: "/admin/classes", label: "Classes", icon: GraduationCap },
      { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
    ],
  },
  // Retired: the standalone Questions, Tests, Chapters & tagging, Videos and
  // Free samples screens now live inside the offering workspace, and Bundles
  // are dropped from the model entirely. Their route files are still on disk
  // but are no longer reachable from the nav.
  {
    label: "Commerce",
    items: [
      { href: "/admin/plans", label: "Plans & pricing", icon: BadgeIndianRupee },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { href: "/admin/orders", label: "Orders", icon: Receipt },
      { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
    ],
  },
  {
    // Organizations is retired with the rest of the coaching/B2B stack — it has
    // no tables in the decoupled database. Its route files remain on disk.
    label: "People",
    items: [
      { href: "/admin/students", label: "Students", icon: Users },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.ok && setMe(d.data));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        // 5.2-F2: hidden below lg; mobile uses the AdminMobileNav drawer instead.
        "hidden lg:flex flex-col border-r border-border/60 bg-surface transition-all duration-200 sticky top-0 h-screen",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/60">
        <Link href="/admin" className="flex items-center gap-2.5 min-w-0">
          {collapsed ? (
            <LogoMark className="h-8 w-8 rounded-lg bg-foreground text-background" />
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <Logo showWordmark={false} />
              <div className="min-w-0">
                <p className="font-semibold tracking-tight truncate leading-none">
                  Test<span className="font-display italic">quest</span>
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Admin</p>
              </div>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        {adminNavSections.map((section) => (
          <div key={section.label} className="mb-5 px-3">
            {!collapsed && (
              <p className="px-2.5 mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-gold"
                        : "text-muted-foreground hover:bg-surface-hi hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span className={cn(
                        "ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                        item.badge === "New"
                          ? "bg-primary/15 text-primary"
                          : "border border-border text-muted-foreground",
                        isActive && "bg-white/20 text-primary-foreground border-transparent",
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Theme toggle + User */}
      <div className="border-t border-border/60 p-3 space-y-2">
        {!collapsed && (
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs text-muted-foreground">Appearance</span>
            <ThemeToggle />
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        )}
        {!collapsed && me ? (
          <div className="rounded-lg bg-surface-hi p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                {me.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{me.name}</p>
                <p className="text-xs text-muted-foreground truncate">{me.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="flex w-full items-center justify-center rounded-md px-2 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}

export function AdminPageHeader({
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
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
