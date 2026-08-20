"use client";

/**
 * Video manager (design 2c): within the curriculum context, paste a YouTube
 * URL → the server extracts the id and fetches the title via oEmbed. Errors
 * name the fix. List per chapter with active toggle and archive.
 */
import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { CurriculumContextBar, useCurriculumContext } from "@/components/admin/curriculum-context-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Loader2, Plus, Archive, PlaySquare } from "lucide-react";

interface VideoRow {
  id: number; title: string; videoRef: string; chapterId: number | null;
  durationSeconds: number | null; isActive: boolean;
}
interface ChapterOpt { id: number; name: string }

export default function AdminVideosPage() {
  const { ctx, update, complete, loaded } = useCurriculumContext(true);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [chapters, setChapters] = useState<ChapterOpt[]>([]);
  const [url, setUrl] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!complete || !ctx) return;
    setLoading(true);
    const q = `boardId=${ctx.boardId}&classId=${ctx.classId}&subjectId=${ctx.subjectId}`;
    Promise.all([
      fetch(`/api/admin/videos?${q}`).then((r) => r.json()),
      fetch(`/api/admin/chapters?${q}`).then((r) => r.json()),
    ]).then(([v, c]) => {
      if (v.ok) setVideos(v.data);
      if (c.ok) setChapters(c.data.chapters);
    }).finally(() => setLoading(false));
  }, [ctx, complete]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!ctx || !url.trim()) return;
    setAdding(true); setError(null);
    const d = await fetch("/api/admin/videos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardId: ctx.boardId, classId: ctx.classId, subjectId: ctx.subjectId,
        chapterId: chapterId ? Number(chapterId) : null, url: url.trim(),
      }),
    }).then((r) => r.json());
    setAdding(false);
    if (d.ok) { setUrl(""); load(); }
    else setError(d.error || "Could not add the video");
  }

  async function toggle(v: VideoRow) {
    await fetch(`/api/admin/videos/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    load();
  }

  function fmtDur(s: number | null) {
    if (!s) return "—";
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <div className="p-6 lg:p-10">
      <CurriculumContextBar ctx={ctx} onChange={update} coverage={<>{videos.length} videos in this subject</>} />
      <AdminPageHeader title="Videos" subtitle="YouTube lessons mapped to chapters — upload Unlisted on the brand channel" />

      {!loaded ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !complete ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">Pick a board, class and subject above.</div>
      ) : (
        <>
          {/* Add video */}
          <div className="mb-5 rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a YouTube watch or share URL…"
                className="h-10 flex-1 min-w-[260px]"
              />
              <Select value={chapterId} onChange={(e) => setChapterId(e.target.value)} className="h-10 w-auto min-w-[160px]">
                <option value="">No chapter (subject level)</option>
                {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Button onClick={add} disabled={adding || !url.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add video
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-[color:var(--error)]">{error}</p>}
          </div>

          {/* List */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : videos.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">No videos yet — paste the first URL above.</div>
            ) : (
              videos.map((v, i) => (
                <div key={v.id} className={`flex items-center gap-3 p-3.5 ${i > 0 ? "border-t" : ""}`}>
                  {/* Admin-only thumbnail — never shown to locked students */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${v.videoRef}/default.jpg`}
                    alt=""
                    className="h-12 w-16 rounded-md object-cover bg-muted"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{v.title}</p>
                    <p className="text-[11px] text-text-muted-2">
                      {fmtDur(v.durationSeconds)} · {chapters.find((c) => c.id === v.chapterId)?.name ?? "Subject level"} · {v.videoRef}
                    </p>
                  </div>
                  <Badge variant={v.isActive ? "success" : "secondary"}>{v.isActive ? "Active" : "Hidden"}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => toggle(v)}>
                    {v.isActive ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="text-[color:var(--warning)]"
                    onClick={async () => { if (confirm("Archive this video?")) { await fetch(`/api/admin/videos/${v.id}`, { method: "DELETE" }); load(); } }}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-text-muted-2">
            <PlaySquare className="h-3.5 w-3.5" />
            Re-uploads change the YouTube id — to replace a video, archive it and paste the new URL.
          </p>
        </>
      )}
    </div>
  );
}
