"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ChevronDown, ChevronRight, CheckCircle2,
  Gift, ClipboardList, BookOpen, FileWarning, BadgeIndianRupee, Tag,
} from "lucide-react";
import type { TrayData } from "@/app/admin/(authenticated)/page";

/**
 * Needs attention — the cleanup to-do list.
 *
 * Everything here is a real gap somebody has to close: shelves missing pieces,
 * tests a student would open and find empty, and the content defects the
 * migration carried over. Each group collapses so the list stays scannable,
 * and each entry links to the place that fixes it.
 *
 * The content defects are the ones worth reading carefully: the renderer
 * repairs how they *look*, but the underlying data is still wrong.
 */
type Group = {
  key: string;
  icon: typeof AlertTriangle;
  title: string;
  detail: string;
  count: number;
  severity: "high" | "medium";
  items: Array<{ id: string; label: string; note?: string; href: string }>;
};

export function NeedsAttentionTray({ tray }: { tray: TrayData }) {
  const [open, setOpen] = useState<string | null>(null);

  const defectTotal = tray.contentDefects.reduce(
    (n, d) => n + d.unrenderableMath + d.deadImages + d.mojibake, 0,
  );

  const allGroups: Group[] = [
    {
      key: "emptyTests",
      icon: ClipboardList,
      title: "Tests with no questions",
      detail: "A student opening one of these finds an empty paper.",
      count: tray.emptyTests.length,
      severity: "high",
      items: tray.emptyTests.map((t) => ({
        id: `t${t.testId}`,
        label: t.name,
        note: t.label,
        href: `/admin/offerings/${t.offeringId}?tab=tests`,
      })),
    },
    {
      key: "noFreeSample",
      icon: Gift,
      title: "Offerings with no free sample",
      detail: "Nothing for a prospective student to try before buying.",
      count: tray.noFreeSample.length,
      severity: "high",
      items: tray.noFreeSample.map((o) => ({
        id: `f${o.offeringId}`,
        label: o.label,
        href: `/admin/offerings/${o.offeringId}?tab=free-sample`,
      })),
    },
    {
      key: "noChapters",
      icon: BookOpen,
      title: "Offerings with no chapters",
      detail: "Nothing can be tagged or taught until a chapter exists.",
      count: tray.noChapters.length,
      severity: "medium",
      items: tray.noChapters.map((o) => ({
        id: `c${o.offeringId}`,
        label: o.label,
        href: `/admin/offerings/${o.offeringId}?tab=chapters`,
      })),
    },
    {
      key: "noTests",
      icon: ClipboardList,
      title: "Offerings with no tests",
      detail: "The shelf has no paper to sit.",
      count: tray.noTests.length,
      severity: "medium",
      items: tray.noTests.map((o) => ({
        id: `n${o.offeringId}`,
        label: o.label,
        href: `/admin/offerings/${o.offeringId}?tab=tests`,
      })),
    },
    {
      key: "untagged",
      icon: Tag,
      title: "Questions with no chapter",
      detail: "These belong to no shelf, so no test can draw on them.",
      count: tray.untaggedQuestions.reduce((n, s) => n + s.count, 0),
      severity: "medium",
      items: tray.untaggedQuestions.map((s) => ({
        id: `u${s.subjectId}`,
        label: s.subjectName,
        note: `${s.count} question${s.count === 1 ? "" : "s"}`,
        href: `/admin/offerings`,
      })),
    },
    {
      key: "missingPlans",
      icon: BadgeIndianRupee,
      title: "Board + class without full pricing",
      detail: "A class pass is sold in 3, 6 and 12 month terms — all three must be priced and active.",
      count: tray.missingPlans.length,
      severity: "high",
      items: tray.missingPlans.map((p) => ({
        id: `p${p.boardId}-${p.classId}`,
        label: p.label,
        note: p.durations.length ? `only ${p.durations.join("/")}mo priced` : "nothing priced",
        // Scoped so the grid opens on this row rather than 30 anonymous ones.
        href: `/admin/plans?boardId=${p.boardId}&classId=${p.classId}`,
      })),
    },
    {
      key: "defects",
      icon: FileWarning,
      title: "Content carried over damaged",
      detail:
        "Rendering repairs how these look, but the stored data is still wrong — worth fixing at source before the production cutover.",
      count: defectTotal,
      severity: "medium",
      items: tray.contentDefects.map((d) => ({
        id: `d${d.offeringId}`,
        label: d.label,
        note: [
          d.unrenderableMath ? `${d.unrenderableMath} Word-math` : null,
          d.deadImages ? `${d.deadImages} dead image${d.deadImages === 1 ? "" : "s"}` : null,
          d.mojibake ? `${d.mojibake} garbled character${d.mojibake === 1 ? "" : "s"}` : null,
        ].filter(Boolean).join(" · "),
        href: `/admin/offerings/${d.offeringId}?tab=questions`,
      })),
    },
  ];
  const groups = allGroups.filter((g) => g.count > 0);

  if (groups.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-green-600/30 bg-green-50 p-4 dark:bg-green-950/20">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
        <div>
          <p className="font-medium text-green-800 dark:text-green-400">Nothing needs attention</p>
          <p className="text-sm text-green-700/80 dark:text-green-500/80">
            Every offering has its chapters, tests, sample and pricing in place.
          </p>
        </div>
      </div>
    );
  }

  const totalItems = groups.reduce((n, g) => n + g.count, 0);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b bg-amber-50/60 px-4 py-3 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
        <p className="font-medium">Needs attention</p>
        <Badge variant="warning" className="text-[10px]">{totalItems}</Badge>
        <p className="ml-auto text-xs text-muted-foreground">{groups.length} kinds of gap</p>
      </div>

      <ul>
        {groups.map((g) => {
          const Icon = g.icon;
          const isOpen = open === g.key;
          return (
            <li key={g.key} className="border-b last:border-0">
              <button
                onClick={() => setOpen(isOpen ? null : g.key)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hi/50"
                aria-expanded={isOpen}
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
                <Icon className={cn(
                  "h-4 w-4 flex-shrink-0",
                  g.severity === "high" ? "text-amber-600" : "text-muted-foreground",
                )} />
                <span className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium">{g.title}</span>
                  <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{g.detail}</span>
                </span>
                <Badge variant={g.severity === "high" ? "warning" : "secondary"} className="flex-shrink-0 text-[10px]">
                  {g.count}
                </Badge>
              </button>

              {isOpen && (
                <ul className="bg-surface-hi/30 px-4 pb-3 pt-0.5">
                  <li className="pb-2 pl-7 text-xs text-muted-foreground sm:hidden">{g.detail}</li>
                  {g.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-baseline gap-2 rounded px-1 py-1 pl-7 text-[13px] hover:bg-card"
                      >
                        <span className="truncate">{item.label}</span>
                        {item.note && (
                          <span className="flex-shrink-0 text-[11px] text-muted-foreground">{item.note}</span>
                        )}
                        <ChevronRight className="ml-auto h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
