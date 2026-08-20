import { NextRequest } from "next/server";

/**
 * Helpers for invoking App Router route handlers directly.
 *
 * Handlers are plain functions of (Request, { params }), so they can be called
 * without a server. Next 16 passes route params as a Promise, which `routeCtx`
 * mirrors so tests exercise the same signature production does.
 */
const BASE = "http://localhost:3000";

export function jsonRequest(path: string, body: unknown, method = "POST"): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getRequest(path: string): NextRequest {
  return new NextRequest(`${BASE}${path}`);
}

/**
 * A request with no body, for handlers reached by GET or DELETE. `Request`
 * throws if a GET/HEAD carries a body, so these cannot reuse `jsonRequest`.
 */
export function bareRequest(path = "/", method = "GET"): Request {
  return new Request(`${BASE}${path}`, { method });
}

/** Route context for a dynamic segment, e.g. routeCtx({ id: "25" }). */
export function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

/** Unwraps a handler's Response into { status, ok, data, error }. */
export async function readJson(res: Response): Promise<{
  status: number;
  ok: boolean;
  data?: unknown;
  error?: string;
}> {
  const body = (await res.json()) as { ok: boolean; data?: unknown; error?: string };
  return { status: res.status, ok: body.ok, data: body.data, error: body.error };
}
