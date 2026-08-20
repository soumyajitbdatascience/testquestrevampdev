import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * Import template for one offering.
 *
 * The sample rows use this offering's real chapter names, so the author can
 * copy a value straight down the column instead of guessing what the importer
 * will accept. A second sheet lists every valid chapter name.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);

    const offering = await prisma.offering.findUnique({
      where: { id: offeringId },
      include: {
        board: { select: { code: true } },
        class: { select: { name: true } },
        subject: { select: { name: true } },
        chapters: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { name: true } },
      },
    });
    if (!offering) return new Response("Offering not found", { status: 404 });

    const firstChapter = offering.chapters[0]?.name ?? "";

    const sample = [
      {
        chapter: firstChapter,
        type: "SINGLE_MCQ",
        difficulty: "MEDIUM",
        question_text: "What is 2 + 2?",
        option_a: "3", option_b: "4", option_c: "5", option_d: "6",
        correct_answer: "B",
        explanation: "Basic addition.",
        marks: 1,
      },
      {
        chapter: firstChapter,
        type: "MULTI_MCQ",
        difficulty: "HARD",
        question_text: "Which of these are prime?",
        option_a: "2", option_b: "4", option_c: "7", option_d: "9",
        correct_answer: "A,C",
        explanation: "2 and 7 are prime.",
        marks: 2,
      },
      {
        chapter: "",
        type: "FILL_IN_BLANK",
        difficulty: "EASY",
        question_text: "The square root of 144 is ___",
        option_a: "", option_b: "", option_c: "", option_d: "",
        correct_answer: "12",
        explanation: "12 × 12 = 144. Leave chapter blank to import untagged.",
        marks: 1,
      },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), "Questions");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        offering.chapters.length
          ? offering.chapters.map((c) => ({ valid_chapter_names: c.name }))
          : [{ valid_chapter_names: "(no chapters yet — add them on the Chapters tab)" }],
      ),
      "Chapters",
    );

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const slug = `${offering.board.code}-${offering.class.name}-${offering.subject.name}`
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="questions-${slug}.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
