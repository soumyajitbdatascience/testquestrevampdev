import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { ensureOfferingId, findOfferingId } from "@/lib/offerings";

/**
 * Video manager (design 2c). Admin pastes a YouTube URL; the server extracts
 * the 11-char id and fetches the title via oEmbed (no API key). Videos must
 * be Unlisted with embedding allowed on the brand channel.
 */
const createSchema = z.object({
  boardId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  chapterId: z.number().int().positive().nullable(),
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

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");
    const p = request.nextUrl.searchParams;
    const boardId = Number(p.get("boardId"));
    const classId = Number(p.get("classId"));
    const subjectId = Number(p.get("subjectId"));
    if (!boardId || !classId || !subjectId) return error("boardId, classId, subjectId required", 400);

    const offeringId = await findOfferingId(boardId, classId, subjectId);
    const videos = offeringId
      ? await prisma.video.findMany({
          where: { offeringId },
          orderBy: [{ chapterId: "asc" }, { sortOrder: "asc" }],
        })
      : [];
    return success(videos);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);

    const videoRef = extractYouTubeId(body.url);
    if (!videoRef) {
      return error("Invalid URL — paste the full watch or share URL.", 400);
    }

    // oEmbed title fetch (also proves the video is embeddable & not private)
    let title = body.title ?? "";
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoRef}`)}&format=json`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (res.status === 401 || res.status === 403) {
        return error("Embedding disabled — enable Allow embedding in YouTube Studio → Details → Advanced.", 400);
      }
      if (res.status === 404 || res.status === 400) {
        return error("Video is Private or removed — set it to Unlisted on the brand channel, then paste again.", 400);
      }
      if (res.ok) {
        const meta = (await res.json()) as { title?: string };
        if (!title) title = meta.title ?? "";
      }
    } catch {
      // Network hiccup: allow save if the admin supplied a title themselves
      if (!title) return error("Couldn't reach YouTube to verify — try again, or enter a title manually.", 502);
    }
    if (!title) title = `Video ${videoRef}`;

    const offeringId = await ensureOfferingId(body.boardId, body.classId, body.subjectId);
    const last = await prisma.video.findFirst({
      where: { offeringId, chapterId: body.chapterId },
      orderBy: { sortOrder: "desc" },
    });
    const video = await prisma.video.create({
      data: {
        offeringId,
        chapterId: body.chapterId,
        title,
        videoRef,
        durationSeconds: body.durationSeconds ?? null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    return success(video, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
