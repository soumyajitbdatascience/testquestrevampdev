"use client";

/**
 * Video player page (design 1h). Subscribed: youtube-nocookie 16:9 embed,
 * chapter context, actions, "Up next" mixing videos and tests. Unsubscribed:
 * locked hero + unlock panel — the YouTube id never reaches this client.
 */
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Lock, Play, CheckCircle2, ArrowRight } from "lucide-react";
import { Paywall } from "@/components/student/paywall";
import { SecondaryBar } from "@/components/student/student-shell";

interface VideoData {
  id: number; title: string; durationSeconds: number | null;
  covered: boolean; videoRef?: string;
  board: { id: number; name: string; code: string };
  class: { id: number; name: string };
  subject: { id: number; name: string };
  chapter: { id: number; name: string } | null;
  position: number; totalInChapter: number;
  upNext: {
    videos: Array<{ id: number; title: string; durationSeconds: number | null; videoRef?: string }>;
    tests: Array<{ id: number; name: string }>;
  };
  minPrice: number | null;
}

function fmtDur(s: number | null): string {
  if (!s) return "";
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/videos/${id}`).then((r) => r.json()).then((d) => d.ok && setData(d.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-bg-alt"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-alt">
        <p className="text-sm text-text-secondary">Video not found.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-primary">Back home</Link>
      </div>
    );
  }

  return (
    <div>
      <SecondaryBar
        backHref={`/offerings/${data.subject.id}`}
        title={data.title}
        subtitle={<>{data.subject.name}{data.chapter && <> · {data.chapter.name}</>}</>}
      />

      <main className="mx-auto max-w-3xl px-4 py-5">
        {data.covered && data.videoRef ? (
          <>
            <div className="overflow-hidden rounded-[16px] border bg-black aspect-video">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${data.videoRef}?rel=0`}
                title={data.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-ink">{data.title}</h2>
            <p className="mt-0.5 text-[12.5px] text-text-secondary">
              Video {data.position} of {data.totalInChapter}
              {data.chapter && <> · {data.chapter.name}</>}
              {data.durationSeconds != null && <> · {fmtDur(data.durationSeconds)}</>}
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {data.upNext.tests[0] && (
                <button
                  onClick={() => router.push(`/tests/${data.upNext.tests[0].id}`)}
                  className="h-11 rounded-[12px] bg-primary px-4 text-sm font-bold text-primary-foreground"
                >
                  Take a test on this topic
                </button>
              )}
              <button
                onClick={() => setWatched(true)}
                disabled={watched}
                className="inline-flex h-11 items-center gap-1.5 rounded-[12px] border px-4 text-sm font-semibold text-text-secondary disabled:text-success"
              >
                <CheckCircle2 className="h-4 w-4" /> {watched ? "Watched" : "Mark watched"}
              </button>
            </div>
          </>
        ) : (
          /* Locked variant — a branded placeholder, never the YouTube
             thumbnail: that URL contains the video id, and on an unlisted
             video the id is the access control. Title and duration come from
             our own payload, which carries no ref at all. */
          <div className="grid gap-4 md:grid-cols-[1fr_260px]">
            <div className="flex aspect-video flex-col items-center justify-center gap-2.5 rounded-[16px] bg-wash text-center px-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-soft">
                <Lock className="h-5 w-5 text-primary" />
              </span>
              <p className="font-display text-lg font-bold text-ink">{data.title}</p>
              <p className="text-sm text-text-secondary">
                Included with the {data.class.name} pass — subscribe once and every
                video in every subject unlocks together.
              </p>
              {data.durationSeconds != null && (
                <span className="rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold text-text-secondary">{fmtDur(data.durationSeconds)}</span>
              )}
            </div>
            <div className="rounded-[16px] bg-primary p-5 text-primary-foreground">
              <p className="font-display text-[16px] font-bold">Unlock every video and test in {data.class.name}</p>
              <button
                onClick={() => setPaywallOpen(true)}
                className="mt-4 h-11 w-full rounded-[12px] bg-white text-sm font-bold text-primary"
              >
                See plans{data.minPrice != null && <> — from ₹{data.minPrice}</>}
              </button>
            </div>
          </div>
        )}

        {/* Up next */}
        {(data.upNext.videos.length > 0 || data.upNext.tests.length > 0) && (
          <div className="mt-8">
            <h3 className="mb-3 font-display text-[15px] font-bold text-ink">
              Up next{data.chapter && <> in {data.chapter.name}</>}
            </h3>
            <div className="overflow-hidden rounded-[16px] border bg-card">
              {data.upNext.videos.map((v, i) => (
                <button
                  key={`v${v.id}`}
                  onClick={() => router.push(`/videos/${v.id}`)}
                  className={`flex w-full items-center gap-3 p-3.5 text-left hover:bg-wash/60 ${i > 0 ? "border-t" : ""}`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wash text-primary"><Play className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{v.title}</span>
                  <span className="text-[11px] text-text-secondary">{fmtDur(v.durationSeconds)}</span>
                </button>
              ))}
              {data.upNext.tests.map((t) => (
                <button
                  key={`t${t.id}`}
                  onClick={() => router.push(`/tests/${t.id}`)}
                  className="flex w-full items-center gap-3 border-t p-3.5 text-left hover:bg-wash/60"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-tint text-success"><ArrowRight className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{t.name}</span>
                  <span className="rounded-[8px] bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">Start</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <Paywall
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        boardId={data.board.id}
        classId={data.class.id}
        returnTo={`/videos/${id}`}
      />
    </div>
  );
}
