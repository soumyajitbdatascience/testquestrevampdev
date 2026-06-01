/**
 * CSV bulk student import — Task 5.3.3.
 *
 * Owners onboarding a coaching centre with 50+ students need a faster path
 * than the setup-wizard "Paste roster" textarea. This service parses an
 * uploaded CSV (papaparse), validates each row, then defers to the existing
 * `addStudentsToBatch` so all idempotency + legacy-student-create semantics
 * stay in one place (see `batch.service.ts`).
 *
 * Expected CSV shape:
 *   name,mobile,email
 *   Anita Singh,9876543210,anita@example.com
 *   Rahul Mehta,9123456780
 *
 * Header row required; column order does not matter and header matching is
 * case-insensitive / whitespace-tolerant. `email` is optional. Hard cap of
 * 200 rows per upload — split bigger imports into multiple files.
 */
import Papa from "papaparse";
import { normaliseMobile } from "./invite.service";
import {
  addStudentsToBatch,
  type AddStudentsResult,
  type RosterEntry,
} from "./batch.service";

export type CsvImportErrorCode =
  | "EMPTY"
  | "MISSING_COLUMNS"
  | "TOO_LARGE"
  | "PARSE_FAILED";

export class CsvImportError extends Error {
  constructor(public code: CsvImportErrorCode, message: string) {
    super(message);
    this.name = "CsvImportError";
  }
}

export interface CsvImportResult {
  parsed: number;
  enrolled: AddStudentsResult["enrolled"];
  skipped: Array<{ rowIndex: number; name?: string; reason: string }>;
}

export const CSV_IMPORT_MAX_ROWS = 200;

interface ImportInput {
  orgId: number;
  batchId: number;
  csvText: string;
  /** For audit hooks — currently informational only. */
  actingUserId: number;
}

/** Loose CSV row shape after papaparse header parsing. */
type RawRow = Record<string, string | undefined>;

/** Normalise a header label: lowercase, trim, collapse whitespace. */
function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export async function importStudentsFromCsv(
  input: ImportInput,
): Promise<CsvImportResult> {
  const text = input.csvText.replace(/^﻿/, "").trim();
  if (!text) {
    throw new CsvImportError("EMPTY", "That CSV is empty.");
  }

  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normaliseHeader,
  });

  if (parsed.errors.length) {
    // Most papaparse errors are recoverable; only fail if we got zero data.
    if (!parsed.data || parsed.data.length === 0) {
      throw new CsvImportError(
        "PARSE_FAILED",
        `Could not parse CSV: ${parsed.errors[0].message}`,
      );
    }
  }

  const fields = (parsed.meta.fields ?? []).map((f) => normaliseHeader(f));
  if (!fields.includes("name") || !fields.includes("mobile")) {
    throw new CsvImportError(
      "MISSING_COLUMNS",
      "CSV must have a 'name' column and a 'mobile' column.",
    );
  }

  if (parsed.data.length > CSV_IMPORT_MAX_ROWS) {
    throw new CsvImportError(
      "TOO_LARGE",
      `Imports are capped at ${CSV_IMPORT_MAX_ROWS} rows. Split into smaller batches.`,
    );
  }

  const skipped: CsvImportResult["skipped"] = [];
  const roster: RosterEntry[] = [];
  const seenMobiles = new Set<string>();

  parsed.data.forEach((row, idx) => {
    // rowIndex is 1-based and excludes the header (matches what a user sees
    // in Excel's data area, where row 1 = first record).
    const rowIndex = idx + 1;
    const name = (row.name ?? "").trim();
    const mobileRaw = (row.mobile ?? "").trim();
    const emailRaw = (row.email ?? "").trim();

    if (!name && !mobileRaw && !emailRaw) {
      // Silently drop fully blank rows.
      return;
    }
    if (name.length < 2) {
      skipped.push({ rowIndex, name: name || undefined, reason: "name must be at least 2 characters" });
      return;
    }
    const mobile = normaliseMobile(mobileRaw);
    if (mobile.length !== 10) {
      skipped.push({ rowIndex, name, reason: "mobile must be 10 digits" });
      return;
    }
    if (seenMobiles.has(mobile)) {
      skipped.push({ rowIndex, name, reason: "duplicate mobile within this CSV" });
      return;
    }
    seenMobiles.add(mobile);

    roster.push({
      name,
      mobile,
      email: emailRaw ? emailRaw.toLowerCase() : undefined,
    });
  });

  // Hand off to the existing service — single source of truth for enrollment.
  const addResult = roster.length
    ? await addStudentsToBatch(input.orgId, input.batchId, roster)
    : { enrolled: [], skipped: [] };

  // Map any service-level skips back into our row-indexed shape. We don't know
  // the original row index for these, so we mark them as rowIndex -1.
  for (const s of addResult.skipped) {
    skipped.push({ rowIndex: -1, name: s.name, reason: s.reason });
  }

  return {
    parsed: parsed.data.length,
    enrolled: addResult.enrolled,
    skipped,
  };
}

/** CSV template body returned by GET /api/coaching/batches/students/template. */
export function buildCsvTemplate(): string {
  return [
    "name,mobile,email",
    "Anita Singh,9876543210,anita@example.com",
    "Rahul Mehta,9123456780,",
  ].join("\n") + "\n";
}
