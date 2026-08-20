"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Loader2 } from "lucide-react";
import { ChaptersTab } from "@/components/admin/offering/chapters-tab";
import { QuestionsTab } from "@/components/admin/offering/questions-tab";
import { TestsTab } from "@/components/admin/offering/tests-tab";
import { VideosTab } from "@/components/admin/offering/videos-tab";
import { FreeSampleTab } from "@/components/admin/offering/free-sample-tab";
import { ReadinessRing } from "@/components/admin/offering/readiness-ring";

/**
 * The offering workspace.
 *
 * One page, scoped to one shelf, with everything that belongs to it behind
 * tabs — replacing the five separate global screens the content team used to
 * bounce between. The header stays put while you work so the shelf you're in
 * and how complete it is are always visible.
 *
 * The active tab lives in the URL (?tab=questions) so Launch Readiness can
 * deep-link straight to the unmet item.
 */
export interface OfferingDetail {
  id: number;
  isActive: boolean;
  board: { id: number; name: string; code: string };
  class: { id: number; name: string };
  subject: { id: number; name: string };
  label: string;
  counts: { chapters: number; tests: number; videos: number; questions: number; subjectBank: number };
  freeTestId: number | null;
}

const TABS = ["chapters", "questions", "tests", "videos", "free-sample"] as const;
type TabKey = (typeof TABS)[number];

export default function OfferingWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const offeringId = Number(id);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [offering, setOffering] = useState<OfferingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "chapters";

  // `loading` starts true, so nothing is set synchronously inside the effect.
  const loadOffering = useCallback(async () => {
    const res = await fetch(`/api/admin/offerings/${offeringId}`);
    const data = await res.json();
    if (data.ok) setOffering(data.data);
    else setNotFound(true);
    setLoading(false);
  }, [offeringId]);

  useEffect(() => { loadOffering(); }, [loadOffering]);

  function setTab(tab: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.replace(`/admin/offerings/${offeringId}?${next.toString()}`, { scroll: false });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !offering) {
    return (
      <div className="p-6 lg:p-10">
        <div className="rounded-2xl border bg-card p-16 text-center">
          <p className="font-medium">Offering not found</p>
          <Link href="/admin/offerings" className="mt-2 inline-block text-sm text-primary hover:underline">
            Back to offerings
          </Link>
        </div>
      </div>
    );
  }

  // Readiness: the four things a shelf needs before it can be sold.
  const done =
    (offering.counts.chapters > 0 ? 1 : 0) +
    (offering.counts.questions > 0 ? 1 : 0) +
    (offering.counts.tests > 0 ? 1 : 0) +
    (offering.freeTestId != null ? 1 : 0);

  return (
    <div>
      {/* Sticky header — the shelf you're in, and how far along it is. */}
      <div className="sticky top-0 z-20 border-b bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="px-6 pt-5 pb-3 lg:px-10">
          <Link
            href="/admin/offerings"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
            All offerings
          </Link>

          <div className="mt-2 flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="font-display text-3xl tracking-tight md:text-4xl">
                <span className="text-muted-foreground">{offering.board.code}</span>
                <span className="mx-2 text-muted-foreground/50">▸</span>
                <span className="text-muted-foreground">{offering.class.name}</span>
                <span className="mx-2 text-muted-foreground/50">▸</span>
                {offering.subject.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{offering.counts.chapters} chapters</Badge>
                <Badge
                  variant="secondary"
                  className="text-[10px]"
                  title={`${offering.counts.subjectBank.toLocaleString()} questions exist for ${offering.subject.name} across all classes that offer it`}
                >
                  {offering.counts.questions.toLocaleString()} questions
                </Badge>
                <Badge variant="secondary" className="text-[10px]">{offering.counts.tests} tests</Badge>
                {offering.freeTestId == null && (
                  <Badge variant="warning" className="text-[10px]">No free sample</Badge>
                )}
                {!offering.isActive && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
              </div>
            </div>
            <ReadinessRing done={done} total={4} />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto px-6 pb-0 lg:px-10">
            <TabsTrigger value="chapters" className="flex-none">
              Chapters
              <span className="ml-1.5 text-[10px] text-muted-foreground">{offering.counts.chapters}</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex-none">
              Questions
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {offering.counts.questions.toLocaleString()}
              </span>
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex-none">
              Tests
              <span className="ml-1.5 text-[10px] text-muted-foreground">{offering.counts.tests}</span>
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex-none">
              Videos
              <span className="ml-1.5 text-[10px] text-muted-foreground">{offering.counts.videos}</span>
            </TabsTrigger>
            <TabsTrigger value="free-sample" className="flex-none">Free sample</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-6 py-6 lg:px-10">
        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsContent value="chapters">
            <ChaptersTab offeringId={offering.id} onChanged={loadOffering} />
          </TabsContent>
          <TabsContent value="questions">
            <QuestionsTab offeringId={offering.id} onChanged={loadOffering} />
          </TabsContent>
          <TabsContent value="tests">
            <TestsTab offeringId={offering.id} onChanged={loadOffering} />
          </TabsContent>
          <TabsContent value="videos">
            <VideosTab offeringId={offering.id} onChanged={loadOffering} />
          </TabsContent>
          <TabsContent value="free-sample">
            <FreeSampleTab offeringId={offering.id} onChanged={loadOffering} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
