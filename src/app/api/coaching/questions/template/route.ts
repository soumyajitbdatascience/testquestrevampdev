/**
 * GET /api/coaching/questions/template
 *
 * Returns the .xlsx template the owner uploads to bulk-import questions
 * into their private bank. Keyed off `subject_id` (we deferred the chapter
 * taxonomy per CLAUDE.md decision #8).
 *
 * Sample rows show one of each supported type.
 */
import * as XLSX from "xlsx";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);

    const sampleData = [
      {
        subject_id: 339,
        type: "SINGLE_MCQ",
        difficulty: "MEDIUM",
        question_text: "What is 2 + 2?",
        option_a: "3",
        option_b: "4",
        option_c: "5",
        option_d: "6",
        correct_answer: "B",
        explanation: "Basic addition: 2 + 2 = 4",
        marks: 1,
      },
      {
        subject_id: 339,
        type: "MULTI_MCQ",
        difficulty: "HARD",
        question_text: "Which of these are prime numbers?",
        option_a: "2",
        option_b: "4",
        option_c: "7",
        option_d: "9",
        correct_answer: "A,C",
        explanation: "2 and 7 are prime",
        marks: 2,
      },
      {
        subject_id: 339,
        type: "FILL_IN_BLANK",
        difficulty: "EASY",
        question_text: "The square root of 144 is ___",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        correct_answer: "12",
        explanation: "12 × 12 = 144",
        marks: 1,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=coaching_questions_template.xlsx",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
