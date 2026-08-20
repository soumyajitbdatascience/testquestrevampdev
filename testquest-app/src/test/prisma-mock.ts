import { beforeEach, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Deep mock of the Prisma client, swapped in for `@/lib/db`.
 *
 * Every route and lib module imports the singleton from `@/lib/db`, so mocking
 * that one module is enough to keep the entire suite off the network. Any query
 * a test does not explicitly stub returns `undefined`, which surfaces as a
 * failure rather than silently hitting a real database.
 */
export const prismaMock = mockDeep<PrismaClient>();

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

/**
 * `requireAuth` reads an httpOnly cookie through `next/headers`, which has no
 * meaning outside a request. Admin auth itself is smoke-tested only (§3.3), so
 * routes under test are given an authenticated admin by default; a test that
 * cares can override the mock.
 */
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getSession: vi.fn(async () => ({ id: 1, email: "admin@testquest.in", role: "admin" as const })),
    requireAuth: vi.fn(async () => ({ id: 1, email: "admin@testquest.in", role: "admin" as const })),
  };
});

beforeEach(() => {
  mockReset(prismaMock);
});

export type PrismaMock = DeepMockProxy<PrismaClient>;
