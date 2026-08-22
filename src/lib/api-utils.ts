import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";

// Make BigInt safe for JSON.stringify globally — needed because some MySQL views
// (e.g. `exam_id + 1000000` expressions) return BIGINT regardless of magnitude.
// Numbers up to 2^53 are exact, which is fine for our id ranges.
declare global {
  interface BigInt { toJSON(): number }
}
if (typeof (BigInt.prototype as unknown as { toJSON?: unknown }).toJSON !== "function") {
  Object.defineProperty(BigInt.prototype, "toJSON", {
    value: function () { return Number(this); },
    configurable: true,
  });
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

/** Turn a dotted/camelCase/snake_case field path into a readable label. */
function fieldLabel(path: ReadonlyArray<PropertyKey>): string {
  const last = [...path].reverse().find((p) => typeof p === "string") as
    | string
    | undefined;
  if (!last) return "This field";
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Render a single Zod issue into a short, user-facing sentence. */
function prettifyZodIssue(issue: ZodError["issues"][number]): string {
  const label = fieldLabel(issue.path);
  // Zod v4 issue shapes vary by code; read extra fields defensively.
  const i = issue as unknown as Record<string, unknown>;
  switch (issue.code) {
    case "invalid_type": {
      if (i.received === "undefined" || i.input === undefined) {
        return `${label} is required.`;
      }
      return `${label} must be a valid ${String(i.expected ?? "value")}.`;
    }
    case "too_small": {
      const min = i.minimum;
      if (i.origin === "string" || i.type === "string") {
        return `${label} must be at least ${min} character${min === 1 ? "" : "s"}.`;
      }
      return `${label} must be at least ${min}.`;
    }
    case "too_big": {
      const max = i.maximum;
      if (i.origin === "string" || i.type === "string") {
        return `${label} must be at most ${max} character${max === 1 ? "" : "s"}.`;
      }
      return `${label} must be at most ${max}.`;
    }
    case "invalid_format":
      return `${label} is not in a valid format.`;
    case "invalid_value":
      return `${label} has an unsupported value.`;
    default:
      return issue.message ? `${label}: ${issue.message}` : `${label} is invalid.`;
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    const messages = err.issues.map(prettifyZodIssue);
    return error(messages.join(" "), 400);
  }
  if (err instanceof Error) {
    if (err.message === "Unauthorized") return error("Unauthorized", 401);
    if (err.message === "Forbidden") return error("Forbidden", 403);
    return error(err.message, 500);
  }
  return error("Internal server error", 500);
}
