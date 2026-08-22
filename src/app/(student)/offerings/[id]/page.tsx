"use client";

/**
 * Subject page (design 1c): back header with meta line + free-test pill,
 * ordered chapter accordions (test rows with state icons, video tiles),
 * trailing dashed "More tests" group for untagged content, sticky unlock CTA
 * when unsubscribed. Every lock opens the paywall — a lock is a doorway.
 */
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, ChevronDown, Loader2, Lock, Play, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Paywall } from "@/components/student/paywall";
import { SecondaryBar } from "@/components/student/student-shell";

interface TestRow {
  id: number; name: string; durationMinutes: number;
  isPractice: boolean; questionCount: number;
  access: boolean; accessReason: string; bestPct: number | null; isSample: boolean;
}
interface VideoRow {
  id: number; title: string; durationSeconds: number | null;
  chapterId: number | null; videoRef?: string; locked: boolean;
}
interface ChapterRow { id: number; name: string; tests: TestRow[]; videos: VideoRow[]; doneCount: number }
interface SubjectData {
  subject: { id: number; name: string };
  board: { id: number; name: string; code: string };
  class: { id: number; name: string } | null;
  subscribed: boolean;
  minPrice: number | null;
  hasSample: boolean;
  counts: { chapters: number; tests: number; videos: number };
  chapters: ChapterRow[];
  moreTests: TestRow[];
  looseVideos: VideoRow[];
}

function fmtDuration(s: number | null): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<SubjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openChapter, setOpenChapter] = useState<number | "more" | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/offerings/${id}`).then((r) => r.json()).then((d) => {
      if (d.ok) {
        setData(d.data);
        setOpenChapter(d.data.chapters[0]?.id ?? (d.data.moreTests.length ? "more" : null));
      }
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-bg-alt"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg-alt gap-4">
        <p className="text-sm text-text-secondary">Subject not found.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-primary">Back home</Link>
      </div>
    );
  }

  const TestLine = ({ t }: { t: TestRow }) => (
    <button
      onClick={() => (t.access ? router.push(`/tests/${t.id}`) : setPaywallOpen(true))}
      className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-wash/60"
    >
      <span className={cn(
        "flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full",
        t.bestPct != null ? "bg-success text-white" : t.access ? "bg-wash text-primary" : "bg-wash text-text-muted-2",
      )}>
        {t.bestPct != null ? <Check className="h-3.5 w-3.5" /> : t.access ? <Play className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{t.name}</span>
        <span className="block text-[11.5px] text-text-secondary">
          {t.bestPct != null
            ? <span className="text-success font-semibold">Done — {t.bestPct}%</span>
            : <>{t.questionCount} question{t.questionCount === 1 ? "" : "s"} · {t.isPractice ? "untimed" : `${t.durationMinutes} min`}</>}
          {t.isSample && <span className="ml-2 rounded-full bg-success-tint px-1.5 py-0.5 text-[10px] font-bold text-success">Free test</span>}
        </span>
      </span>
      {!t.access && <span className="text-xs font-semibold text-primary">Unlock</span>}
      {t.access && t.bestPct == null && (
        <span className="rounded-[10px] bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Start</span>
      )}
    </button>
  );

  const VideoTile = ({ v }: { v: VideoRow }) => (
    <button
      onClick={() => (v.locked ? setPaywallOpen(true) : router.push(`/videos/${v.id}`))}
      className="overflow-hidden rounded-[12px] border text-left"
    >
      <div className={cn(
        "relative flex aspect-video items-center justify-center",
        v.locked ? "bg-wash" : "bg-[linear-gradient(135deg,#251C5E,var(--primary))]",
      )}>
        {v.locked ? (
          <span className="flex flex-col items-center gap-1 text-text-secondary">
            <Lock className="h-4 w-4" />
            <span className="text-[10px] font-semibold">Included with the pass</span>
          </span>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-primary"><Play className="h-4 w-4" /></span>
        )}
        {v.durationSeconds != null && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">{fmtDuration(v.durationSeconds)}</span>
        )}
      </div>
      <p className="truncate px-2.5 py-2 text-[12px] font-semibold text-ink">{v.title}</p>
    </button>
  );

  // Every video on this offering: the per-chapter ones plus any the API could
  // not place. Deduped by id — a video appears once here even though it also
  // still renders inside its own chapter below.
  const allVideos = [
    ...data.chapters.flatMap((c) => c.videos),
    ...data.looseVideos,
  ].filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i);

  return (
    <div className="pb-28">
      <SecondaryBar
        backHref="/dashboard"
        title={data.subject.name}
        subtitle={<>
          {data.board.code || data.board.name}{data.class && <> · {data.class.name}</>} · {data.counts.chapters} chapters · {data.counts.tests} tests
          {data.counts.videos > 0 && <> · {data.counts.videos} videos</>}
        </>}
        trailing={!data.subscribed && data.hasSample
          ? <span className="rounded-full bg-success-tint px-2.5 py-1 text-[11px] font-bold text-success">1 free test</span>
          : undefined}
      />

      <main className="mx-auto max-w-3xl px-4 py-5 space-y-3">
        {/* Video lessons — every video on this offering, in one place.
            HARDENING, not a bugfix: the tiles below already render inside each
            chapter accordion, and for a single-chapter offering that accordion
            is open by default. But an offering with many chapters can leave a
            video behind a collapsed row while Home still promises "1 video
            lesson", so this section is the guarantee that the promise is always
            one tap from playing. Same VideoTile, same lock treatment — nothing
            about gating changes here. */}
        {data.counts.videos > 0 && (
          <section data-testid="video-lessons" className="rounded-[16px] border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-ink">
              <Play className="h-3.5 w-3.5 text-primary" />
              Video lessons
              <span className="font-sans text-[11px] font-semibold text-text-secondary">
                {allVideos.length}
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              {allVideos.map((v) => <VideoTile key={v.id} v={v} />)}
            </div>
          </section>
        )}

        {data.chapters.map((c, idx) => {
          const open = openChapter === c.id;
          return (
            <div key={c.id} className="overflow-hidden rounded-[16px] border bg-card">
              <button
                onClick={() => setOpenChapter(open ? null : c.id)}
                className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left", open && "bg-wash")}
              >
                <span className="font-display text-sm font-bold text-accent">{String(idx + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-sm font-semibold text-ink">{c.name}</span>
                <span className="text-[11px] text-text-secondary">
                  {c.tests.length} test{c.tests.length === 1 ? "" : "s"}
                  {c.videos.length > 0 && <> · {c.videos.length} video{c.videos.length === 1 ? "" : "s"}</>}
                  {data.subscribed && c.doneCount > 0 && <> · <span className="text-success font-semibold">{c.doneCount} done</span></>}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-text-muted-2 transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="border-t">
                  {c.tests.map((t) => <TestLine key={t.id} t={t} />)}
                  {/* The tiles themselves now live in the Video lessons section
                      above — repeating them here showed the same video twice on
                      a single-chapter offering. The count stays in the chapter
                      header, which is the part that says where a video belongs. */}
                </div>
              )}
            </div>
          );
        })}

        {/* Virtual "More tests" group for untagged content */}
        {data.moreTests.length > 0 && (
          <div className="overflow-hidden rounded-[16px] border border-dashed bg-card">
            <button
              onClick={() => setOpenChapter(openChapter === "more" ? null : "more")}
              className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left", openChapter === "more" && "bg-wash")}
            >
              <Sparkles className="h-4 w-4 text-text-muted-2" />
              <span className="flex-1 text-sm font-semibold text-ink">More tests</span>
              <span className="text-[11px] text-text-secondary">{data.moreTests.length}</span>
              <ChevronDown className={cn("h-4 w-4 text-text-muted-2 transition-transform", openChapter === "more" && "rotate-180")} />
            </button>
            {openChapter === "more" && (
              <div className="border-t">
                {data.moreTests.map((t) => <TestLine key={t.id} t={t} />)}
              </div>
            )}
          </div>
        )}



        {data.chapters.length === 0 && data.moreTests.length === 0 && (
          <div className="rounded-[16px] border bg-card p-10 text-center text-sm text-text-secondary">
            No tests published for this subject yet.
          </div>
        )}
      </main>

      {/* Sticky unlock CTA (unsubscribed) */}
      {!data.subscribed && data.minPrice != null && data.class && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-bg-alt via-bg-alt/95 to-transparent px-4 pb-5 pt-8">
          <div className="mx-auto max-w-3xl">
            <button
              onClick={() => setPaywallOpen(true)}
              className="h-[50px] w-full rounded-[14px] bg-primary font-bold text-primary-foreground shadow-[0_6px_18px_rgba(97,52,235,.35)]"
            >
              Unlock {data.class.name} — from ₹{data.minPrice}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-text-secondary">One-time payment · No auto-renewal</p>
          </div>
        </div>
      )}

      {data.class && (
        <Paywall
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          boardId={data.board.id}
          classId={data.class.id}
          returnTo={`/offerings/${id}`}
        />
      )}
    </div>
  );
}
