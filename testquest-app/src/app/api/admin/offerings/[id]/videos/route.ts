import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * Videos on one offering, optionally pinned to a chapter.
 *
 * Only the YouTube id is stored, never the URL — it must not reach a client
 * whose pass doesn't cover this offering. Videos are expected to be Unlisted
 * on the brand channel with embedding allowed; the oEmbed lookup below both
 * fetches the title and proves those two things hold.
 */
const createSchema = z.object({
  chapterId: z.number().int().positive().nullable().optional(),
  url: z.string().min(5),
  title: z.string().min(1).max(300).optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
});

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);
    if (!Number.isFinite(offeringId)) return error("Invalid offering id", 400);

    const videos = await prisma.video.findMany({
      where: { offeringId },
      orderBy: [{ chapterId: "asc" }, { sortOrder: "asc" }],
      include: { chapter: { select: { id: true, name: true } } },
    });

    return success(videos.map((v) => ({
      id: v.id,
      title: v.title,
      videoRef: v.videoRef,
      description: v.description,
      durationSeconds: v.durationSeconds,
      sortOrder: v.sortOrder,
      isActive: v.isActive,
      chapter: v.chapter,
    })));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);

    const offering = await prisma.offering.findUnique({ where: { id: offeringId }, select: { id: true } });
    if (!offering) return error("Offering not found", 404);

    const body = await parseBody(request, createSchema);

    if (body.chapterId != null) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: body.chapterId, offeringId },
        select: { id: true },
      });
      if (!chapter) return error("That chapter is not in this offering", 400);
    }

    const videoRef = extractYouTubeId(body.url);
    if (!videoRef) return error("Invalid URL — paste the full watch or share URL.", 400);

    const duplicate = await prisma.video.findFirst({
      where: { offeringId, videoRef },
      select: { id: true },
    });
    if (duplicate) return error("That video is already on this offering.", 409);

    // oEmbed both names the video and proves it is embeddable and not private.
    let title = body.title ?? "";
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoRef}`)}&format=json`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (res.status === 401 || res.status === 403) {
        return error("Embedding is disabled — turn on Allow embedding in YouTube Studio → Details → Advanced.", 400);
      }
      if (res.status === 404 || res.status === 400) {
        return error("That video is Private or removed — set it to Unlisted on the brand channel, then paste again.", 400);
      }
      if (res.ok) {
        const meta = (await res.json()) as { title?: string };
        if (!title) title = meta.title ?? "";
      }
    } catch {
      // Network hiccup: allow the save only if the admin supplied a title.
      if (!title) return error("Couldn't reach YouTube to verify — try again, or enter a title manually.", 502);
    }
    if (!title) title = `Video ${videoRef}`;

    const last = await prisma.video.findFirst({
      where: { offeringId, chapterId: body.chapterId ?? null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const video = await prisma.video.create({
      data: {
        offeringId,
        chapterId: body.chapterId ?? null,
        title,
        videoRef,
        durationSeconds: body.durationSeconds ?? null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
      include: { chapter: { select: { id: true, name: true } } },
    });

    return success(video, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
