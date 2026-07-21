"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StudentHeader, PageHeader } from "@/components/student/student-header";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { AssignedToMe } from "@/components/student/assigned-to-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Search,
  Clock,
  FileText,
  Lock,
  ArrowRight,
  Sparkles,
  X,
} from "lucide-react";
import { DriftingFormulas } from "@/components/decor/drifting-formulas";

const SUBCOLOR: Record<string, string> = {
  Mathematics: "oklch(0.508 0.251 284.3)",
  Physics:     "oklch(0.62 0.15 250)",
  Chemistry:   "oklch(0.68 0.15 355)",
  Biology:     "oklch(0.508 0.251 284.3)",
  Science:     "oklch(0.62 0.15 250)",
  English:     "oklch(0.75 0.15 200)",
  "Social Science": "oklch(0.68 0.15 355)",
  Hindi:       "oklch(0.78 0.17 65)",
  Sanskrit:    "oklch(0.62 0.15 250)",
  "Computer Science": "oklch(0.65 0.17 145)",
  Economics:   "oklch(0.70 0.15 130)",
  Accountancy: "oklch(0.78 0.17 65)",
};

interface Test {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  totalMarks: number;
  isFree: boolean;
  price: string | number;
  isPractice: boolean;
  questionCount: number;
  hasAccess: boolean;
  class: { id: number; name: string } | null;
  subject: { id: number; name: string } | null;
  lastAttempt: { score: number; percentage: string | number } | null;
}

interface Subject { id: number; name: string }
interface ClassNode { id: number; name: string; subjects: Subject[] }

export default function TestsPage() {
  const [classes, setClasses] = useState<ClassNode[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ classId: "", subjectId: "", isFree: "", search: "" });
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    fetch("/api/taxonomy").then((r) => r.json()).then((d) => d.ok && setClasses(d.data));
  }, []);

  const fetchTests = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (filters.classId) params.set("classId", filters.classId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.isFree) params.set("isFree", filters.isFree);
      if (filters.search) params.set("search", filters.search);
      const res = await fetch(`/api/tests?${params.toString()}`);
      const data = await res.json();
      if (data.ok) setTests(data.data.tests);
      else { setTests([]); setFetchError(data.error || "Failed to load tests"); }
    } catch (e) {
      setTests([]);
      setFetchError((e as Error).message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const activeClass = classes.find((c) => c.id === Number(filters.classId));
  const subjects = activeClass?.subjects || [];
  const hasFilters = filters.classId || filters.subjectId || filters.isFree || filters.search;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput }));
  }
  function resetFilters() {
    setFilters({ classId: "", subjectId: "", isFree: "", search: "" });
    setSearchInput("");
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <DriftingFormulas opacity={0.07} />
      <StudentHeader />

      <div className="relative container mx-auto px-6 lg:px-12 py-10">
        <PageHeader
          title="Browse tests"
          subtitle="Find tests by class, subject, or search by name."
        />

        <AssignedToMe />

        {/* Filter bar */}
        <div className="rounded-2xl border bg-surface p-4 sm:p-[18px] mb-8">
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tests by name..."
                className="pl-10 h-11 border bg-surface-hi"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" className="h-11 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
              Search
            </Button>
          </form>

          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              className="h-11 bg-surface-hi border"
              value={filters.classId}
              onChange={(e) => setFilters((f) => ({ ...f, classId: e.target.value, subjectId: "" }))}
            >
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select
              className="h-11 bg-surface-hi border"
              value={filters.subjectId}
              onChange={(e) => setFilters((f) => ({ ...f, subjectId: e.target.value }))}
              disabled={!filters.classId}
            >
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select
              className="h-11 bg-surface-hi border"
              value={filters.isFree}
              onChange={(e) => setFilters((f) => ({ ...f, isFree: e.target.value }))}
            >
              <option value="">Free and paid</option>
              <option value="true">Free only</option>
              <option value="false">Paid only</option>
            </Select>
          </div>

          {hasFilters && (
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <p className="text-sm text-muted-foreground">
                {tests.length} {tests.length === 1 ? "test" : "tests"} found
              </p>
              <button onClick={resetFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3 w-3" />
                Clear filters
              </button>
            </div>
          )}
        </div>

        {fetchError && (
          <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>Failed to load tests:</strong> {fetchError}
          </div>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : tests.length === 0 ? (
          <EmptyState onReset={hasFilters ? resetFilters : undefined} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((test) => <TestCard key={test.id} test={test} />)}
          </div>
        )}
        <PoweredByTestquest />
      </div>
    </div>
  );
}

function TestCard({ test }: { test: Test }) {
  const accessible = test.isFree || test.hasAccess;
  const subjectName = test.subject?.name ?? "";
  const className = test.class?.name ?? "Uncategorized";
  const accent = SUBCOLOR[subjectName] || "var(--primary)";
  const taxonomyLine = subjectName
    ? `${className} · ${subjectName}`
    : className;

  return (
    <Link
      href={`/tests/${test.id}`}
      className="group relative overflow-hidden rounded-[18px] border bg-surface transition-all duration-300 hover:-translate-y-1 hover:shadow-soft flex flex-col"
    >
      {/* Accent bar */}
      <div className="h-1" style={{ background: accent }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {taxonomyLine}
          </p>
          {test.isPractice ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-dim text-primary px-2 py-0.5 text-[10px] font-medium">
              <Sparkles className="h-2.5 w-2.5" />
              Practice
            </span>
          ) : test.isFree ? (
            <span className="rounded-full bg-primary-dim text-primary px-2 py-0.5 text-[10px] font-medium">Free</span>
          ) : test.hasAccess ? (
            <span className="rounded-full bg-primary-dim text-primary px-2 py-0.5 text-[10px] font-medium">Owned</span>
          ) : null}
        </div>

        <h3 className="font-display text-[19px] leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {test.name}
        </h3>

        {test.description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {test.description}
          </p>
        )}

        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {test.questionCount} Qs
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {test.durationMinutes}m
          </span>
          <span>·</span>
          <span>{test.totalMarks} marks</span>
        </div>

        {test.lastAttempt && (
          <div className="mt-3 rounded-[10px] bg-primary-dim px-3 py-2 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Your best</span>
            <span className="font-mono text-primary">{test.lastAttempt.percentage}%</span>
          </div>
        )}

        <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm">
          <span className="text-foreground/90">
            {test.isFree ? (
              <span className="text-[color:var(--score-strong)]">Free</span>
            ) : test.hasAccess ? (
              <span>Unlocked</span>
            ) : (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                ₹{test.price}
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-0.5 text-primary font-medium group-hover:gap-1.5 transition-all">
            {accessible ? "Start" : "View"}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-[18px] border bg-surface p-5 animate-pulse">
          <div className="h-1 -mx-5 -mt-5 bg-white/5" />
          <div className="mt-5 h-3 w-1/3 rounded bg-white/5" />
          <div className="mt-3 h-6 w-3/4 rounded bg-white/5" />
          <div className="mt-2 h-4 w-full rounded bg-white/5" />
          <div className="mt-4 h-12 w-full rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset?: () => void }) {
  return (
    <div className="rounded-[22px] border-2 border-dashed bg-surface/30 p-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-dim text-primary">
        <FileText className="h-7 w-7" />
      </div>
      <h3 className="mt-5 font-display text-2xl">No tests found</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
        {onReset ? "Try adjusting filters, or clear them to see everything." : "Check back soon — new tests are added regularly."}
      </p>
      {onReset && (
        <Button variant="outline" className="mt-5" onClick={onReset}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
