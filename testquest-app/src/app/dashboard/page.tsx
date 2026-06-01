"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StudentHeader, PageHeader } from "@/components/student/student-header";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, Trophy, Target, TrendingUp, ChevronRight, Loader2, ArrowRight, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AchievementPulseRings } from "@/components/decor/achievement-pulse-rings";

interface RecentAttempt {
  id: number;
  status: string;
  score: number | null;
  totalMarks: number;
  percentage: string | number | null;
  startedAt: string;
  finishedAt: string | null;
  test: { id: number; name: string; subject: { name: string } };
}

interface SubjectBreakdown { subject: string; avgPercentage: number; attemptCount: number }

interface DashboardData {
  recentAttempts: RecentAttempt[];
  stats: { totalAttempts: number; completedTests: number; testsAvailable: number; overallAverage: number | null };
  subjectBreakdown: SubjectBreakdown[];
  scoreTrend: { percentage: number; subject: string }[];
}

function scoreColor(pct: number) {
  if (pct >= 75) return "var(--score-strong)";
  if (pct >= 50) return "var(--score-on-track)";
  return "var(--score-needs-work)";
}

function scoreLabel(pct: number) {
  if (pct >= 75) return "Strong";
  if (pct >= 50) return "On track";
  return "Needs work";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/student/dashboard").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]).then(([d, m]) => {
      if (d.ok) setData(d.data);
      if (m.ok) setMe(m.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-background"><StudentHeader /><div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div></div>;
  }

  if (!data) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = me?.name?.split(" ")[0] || "";
  const isEmpty = data.stats.totalAttempts === 0;

  return (
    <div className="min-h-screen bg-background">
      <StudentHeader />

      <div className="container mx-auto px-6 lg:px-12 py-10 max-w-7xl">
        <PageHeader
          title={`${greeting}${firstName ? `, ${firstName}` : ""}.`}
          subtitle={isEmpty ? "Start your first test to see your progress here." : "Here's how your prep is going."}
          action={
            <Button asChild variant="outline">
              <Link href="/tests">Browse tests <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          }
        />

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
          <StatTile icon={<BookOpenCheck className="h-4 w-4" />} value={data.stats.totalAttempts} label="Tests attempted" />
          <StatTile icon={<Trophy className="h-4 w-4" />} value={data.stats.completedTests} label="Completed" />
          <StatTile icon={<Target className="h-4 w-4" />} value={data.stats.overallAverage !== null ? `${data.stats.overallAverage}%` : "—"} label="Average score" highlight={data.stats.overallAverage !== null} />
          <StatTile icon={<TrendingUp className="h-4 w-4" />} value={data.stats.testsAvailable} label="Available" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Trend */}
          <div className="lg:col-span-2 rounded-2xl border bg-surface p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-2xl">Score trend</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Your last completed attempts</p>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>

            {data.scoreTrend.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {data.scoreTrend.length === 0 ? "Complete a few tests to see your trend" : "Complete more tests to see your trend"}
                </p>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.scoreTrend.map((p, i) => ({ x: i + 1, percentage: Number(p.percentage), subject: p.subject }))}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                    <XAxis dataKey="x" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: 12 }}
                      formatter={(value) => [`${value}%`, "Score"]}
                      labelFormatter={(label) => `Attempt ${label}`}
                    />
                    <Area type="monotone" dataKey="percentage" stroke="var(--color-primary)" strokeWidth={2} fill="url(#scoreGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Subject breakdown — new design with circle indicators */}
          <div className="rounded-2xl border bg-surface p-6">
            <h2 className="font-display text-2xl mb-1">Subjects</h2>
            <p className="text-sm text-muted-foreground mb-5">Where you stand</p>

            {data.subjectBreakdown.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Complete tests to see scores</div>
            ) : (
              <div className="space-y-5">
                {data.subjectBreakdown.map((s) => <SubjectRow key={s.subject} subject={s} />)}
              </div>
            )}
          </div>

          {/* Recent attempts */}
          <div className="lg:col-span-3 rounded-2xl border bg-surface overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="font-display text-2xl">Recent attempts</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Your latest test activity</p>
              </div>
              {data.recentAttempts.length > 0 && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/my-attempts">View all <ChevronRight className="h-4 w-4" /></Link>
                </Button>
              )}
            </div>

            {data.recentAttempts.length === 0 ? (
              <div className="p-16 text-center">
                <BookOpenCheck className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
                <p className="font-display text-xl">No attempts yet</p>
                <p className="text-sm text-muted-foreground mt-1">Pick a test and try your first one</p>
                <Button asChild className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
                  <Link href="/tests">Browse tests <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {data.recentAttempts.map((a) => <AttemptRow key={a.id} attempt={a} />)}
              </div>
            )}
          </div>
        </div>
        <PoweredByTestquest />
      </div>
    </div>
  );
}

function StatTile({ icon, value, label, highlight }: { icon: React.ReactNode; value: string | number; label: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border p-5 transition-all",
      highlight ? "bg-primary text-primary-foreground shadow-gold border-transparent" : "bg-surface"
    )}>
      {highlight && (
        <AchievementPulseRings
          color="var(--primary-foreground)"
          anchor="top-left"
          ringCount={2}
          duration={3.2}
          size={36}
        />
      )}
      <div className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-lg",
        highlight ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary-dim text-primary"
      )}>
        {icon}
      </div>
      <p className="relative mt-4 font-display text-[38px] leading-none">{value}</p>
      <p className={cn("relative text-[12.5px] mt-2", highlight ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</p>
    </div>
  );
}

function AttemptRow({ attempt }: { attempt: RecentAttempt }) {
  const inProgress = attempt.status === "IN_PROGRESS" || attempt.status === "PAUSED";
  const href = inProgress ? `/attempts/${attempt.id}` : `/attempts/${attempt.id}/result`;
  const pct = attempt.percentage !== null ? Number(attempt.percentage) : null;
  const color = pct !== null ? scoreColor(pct) : "var(--muted-foreground)";

  return (
    <Link href={href} className="flex items-center gap-4 p-[13px] sm:px-6 sm:py-3.5 hover:bg-white/[0.02] transition-colors">
      <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[12px] bg-primary-dim text-primary font-display">
        {attempt.test.subject.name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">{attempt.test.name}</p>
          {inProgress && (
            <span className="inline-flex items-center rounded-full bg-primary-dim text-primary px-2 py-0.5 text-[10px] font-medium">
              {attempt.status === "PAUSED" ? "Paused" : "In progress"}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {attempt.test.subject.name} · {new Date(attempt.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </p>
      </div>
      <div className="text-right">
        {pct !== null ? (
          <>
            <p className="font-display text-2xl" style={{ color }}>{pct}%</p>
            <p className="text-xs text-muted-foreground">{attempt.score} / {attempt.totalMarks}</p>
          </>
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    </Link>
  );
}

function SubjectRow({ subject }: { subject: SubjectBreakdown }) {
  const color = scoreColor(subject.avgPercentage);
  const label = scoreLabel(subject.avgPercentage);

  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-surface-hi font-mono text-xs"
        style={{ border: `2.5px solid ${color}` }}
      >
        <span style={{ color }}>{subject.avgPercentage}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-sm font-medium truncate">{subject.subject}</p>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ color, background: `${color.replace(")", " / 0.15)")}` }}>
            {label}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-hi overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${subject.avgPercentage}%`, background: color }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {subject.attemptCount} {subject.attemptCount === 1 ? "attempt" : "attempts"}
        </p>
      </div>
    </div>
  );
}
