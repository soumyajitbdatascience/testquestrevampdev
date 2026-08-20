"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2, PlaySquare, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";

/**
 * Videos tab — YouTube lessons on this offering.
 *
 * Paste a URL and the server extracts the id, fetches the title, and verifies
 * the video is embeddable and not private. Videos can sit on a chapter or at
 * offering level (no chapter).
 */
interface VideoRow {
  id: number;
  title: string;
  videoRef: string;
  durationSeconds: number | null;
  sortOrder: number;
  isActive: boolean;
  chapter: { id: number; name: string } | null;
}
interface Chapter { id: number; name: string }

export function VideosTab({ offeringId, onChanged }: { offeringId: number; onChanged?: () => void }) {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/offerings/${offeringId}/videos`);
    const data = await res.json();
    if (data.ok) setVideos(data.data);
    setLoading(false);
  }, [offeringId]);

  useEffect(() => {
    load();
    fetch(`/api/admin/offerings/${offeringId}/chapters`)
      .then((r) => r.json())
      .then((d) => d.ok && setChapters(d.data.map((c: Chapter) => ({ id: c.id, name: c.name }))));
  }, [load, offeringId]);

  async function add() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/offerings/${offeringId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.trim(),
        title: title.trim() || undefined,
        chapterId: chapterId ? Number(chapterId) : null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setDialogOpen(false);
      setUrl(""); setTitle(""); setChapterId("");
      load(); onChanged?.();
    } else {
      setError(data.error || "Could not add that video");
    }
  }

  async function toggleActive(v: VideoRow) {
    const res = await fetch(`/api/admin/offerings/${offeringId}/videos/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error || "Could not update that video");
  }

  async function remove(v: VideoRow) {
    if (!confirm(`Remove "${v.title}"? The video itself stays on YouTube.`)) return;
    const res = await fetch(`/api/admin/offerings/${offeringId}/videos/${v.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) { load(); onChanged?.(); }
    else setError(data.error || "Could not remove that video");
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {videos.length} video{videos.length === 1 ? "" : "s"} · {videos.filter((v) => v.isActive).length} visible
        </p>
        <Button onClick={() => { setError(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          Add video
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-16 text-center">
          <PlaySquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No videos yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste an unlisted YouTube URL — the title is fetched for you.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-[13px]">
            <thead className="border-b bg-surface-hi/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="w-40 px-3 py-2 font-medium">Chapter</th>
                <th className="w-28 px-3 py-2 font-medium">Video id</th>
                <th className="w-24 px-3 py-2 font-medium">Status</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-surface-hi/40">
                  <td className="px-3 py-2 font-medium">{v.title}</td>
                  <td className="px-3 py-2">
                    {v.chapter
                      ? <span className="text-xs">{v.chapter.name}</span>
                      : <Badge variant="secondary" className="text-[10px]">offering level</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`https://www.youtube.com/watch?v=${v.videoRef}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-primary"
                    >
                      {v.videoRef}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={v.isActive ? "success" : "secondary"} className="text-[10px]">
                      {v.isActive ? "visible" : "hidden"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(v)} title={v.isActive ? "Hide" : "Show"}>
                      {v.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm" variant="ghost" title="Remove"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(v)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a video</DialogTitle>
            <DialogDescription>
              Paste the YouTube watch or share URL. It must be Unlisted on the brand channel with
              embedding allowed — only the video id is stored, never the URL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">YouTube URL</Label>
              <Input
                id="url" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vtitle">Title (optional — fetched if blank)</Label>
              <Input id="vtitle" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vchapter">Chapter</Label>
              <Select id="vchapter" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                <option value="">Offering level (no chapter)</option>
                {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={add} disabled={saving || !url.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
