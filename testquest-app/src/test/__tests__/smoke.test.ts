import { describe, expect, it } from "vitest";
import { prismaMock } from "@/test/prisma-mock";

/**
 * §3.5 step 1 — proves the harness itself works before anything depends on it:
 * the alias resolves, the Prisma deep mock is injected in place of the real
 * client, and nothing in the suite can reach a database.
 */
describe("test harness", () => {
  it("resolves the @/ alias and loads app modules", async () => {
    const { sanitizeHtml } = await import("@/lib/sanitize-html");
    expect(sanitizeHtml("<p>ok</p>")).toBe("<p>ok</p>");
  });

  it("injects the Prisma deep mock in place of the real client", async () => {
    const { prisma } = await import("@/lib/db");
    expect(prisma).toBe(prismaMock);
  });

  it("returns stubbed data from the mock without a database", async () => {
    prismaMock.board.findMany.mockResolvedValue([
      { id: 1, name: "CBSE", code: "CBSE", sortOrder: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const { prisma } = await import("@/lib/db");
    await expect(prisma.board.findMany()).resolves.toHaveLength(1);
  });

  it("has no live database connection configured", () => {
    // The setup file blanks DATABASE_URL, so a query that escaped the mock
    // would fail loudly rather than quietly reaching the shared host.
    expect(process.env.DATABASE_URL).toBe("");
  });
});
