import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route guards.
 *
 * /coaching/*  → requires an authenticated user whose JWT has `orgId` set.
 *                Public exceptions: /coaching/login, /coaching/signup, and
 *                anything under /coaching/join (student invite landing).
 *                Missing or invalid token → redirect to /coaching/login.
 *
 * /admin/*     → handled inside the route group's layout (existing pattern).
 *                Not touched by middleware to avoid double-guarding.
 *
 * /dashboard, /my-attempts, /profile, /checkout, /attempts/* →
 *                require any valid session token; logged-out visitors are
 *                redirected to /login?next=<original>. Role-specific rules
 *                stay in the API routes.
 *
 * NOTE: middleware runs on the Edge runtime, so we can't reuse the Node
 * `jsonwebtoken` library that src/lib/auth.ts uses to issue tokens. The
 * `verifyHS256` helper below uses Web Crypto's HMAC-SHA256 — the same
 * algorithm `jsonwebtoken` uses by default — to verify the signature and
 * expiry. Both halves share the JWT_SECRET env var.
 */

const COACHING_PUBLIC = new Set<string>(["/coaching/login", "/coaching/signup"]);
// /coaching/join/[token] — public student invite landing.
// /coaching/assignments/[id] — student-side assignment intro; the page itself
//   enforces auth + enrollment, so we let middleware through to avoid the
//   "consumer student redirected to /coaching/login" confusion.
const COACHING_PUBLIC_PREFIXES = ["/coaching/join", "/coaching/assignments", "/coaching/team/accept", "/coaching/welcome"];

function b64UrlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyHS256(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const data = enc.encode(`${headerB64}.${payloadB64}`);
  const sigBytes = b64UrlToBytes(sigB64);
  // `BufferSource` accepts TypedArrays directly; the cast is only here to
  // satisfy strict TS narrowing of `ArrayBufferLike` vs `ArrayBuffer`.
  const valid = await crypto.subtle.verify(
    "HMAC", key, sigBytes as unknown as BufferSource, data as unknown as BufferSource,
  );
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64UrlToBytes(payloadB64))) as Record<string, unknown>;
    if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Student pages that require a signed-in session. Logged-out visitors are
// redirected to /login?next=<original> instead of hitting APIs that 401 and
// leave the page blank or showing a raw "Unauthorized" string.
const STUDENT_PROTECTED_PREFIXES = ["/dashboard", "/my-attempts", "/profile", "/checkout", "/attempts", "/onboarding", "/my-subscriptions", "/pass", "/progress"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/coaching")) {
    if (COACHING_PUBLIC.has(pathname)) return NextResponse.next();
    if (COACHING_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

    const token = request.cookies.get("token")?.value;
    if (!token) return redirectToLogin(request, "/coaching/login");

    const payload = await verifyHS256(token, process.env.JWT_SECRET ?? "");
    if (!payload || payload.orgId == null) return redirectToLogin(request, "/coaching/login");

    return NextResponse.next();
  }

  if (STUDENT_PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const token = request.cookies.get("token")?.value;
    if (!token) return redirectToLogin(request, "/login");

    const payload = await verifyHS256(token, process.env.JWT_SECRET ?? "");
    if (!payload) return redirectToLogin(request, "/login");
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, loginPath: string) {
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Coaching portal + signed-in-only student pages. API routes have their own auth checks.
  matcher: [
    "/coaching/:path*",
    "/dashboard/:path*", "/dashboard",
    "/my-attempts/:path*", "/my-attempts",
    "/profile/:path*", "/profile",
    "/checkout/:path*", "/checkout",
    "/attempts/:path*",
    "/onboarding/:path*", "/onboarding",
    "/my-subscriptions/:path*", "/my-subscriptions",
    "/pass/:path*",
    "/progress/:path*", "/progress",
  ],
};
