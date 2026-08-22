import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { readJson } from "@/test/http";
import { sendExpiryReminder } from "@/lib/email-lifecycle";

/**
 * The expiry-reminder cron.
 *
 * An unauthenticated endpoint that emails every expiring student is not a thing
 * to leave open, so the first assertions are about the door, not the mail.
 */
vi.mock("@/lib/email-lifecycle", () => ({
  sendExpiryReminder: vi.fn(async () => ({ sent: true })),
}));

const mockSend = vi.mocked(sendExpiryReminder);
const SECRET = "test-cron-secret";

function req(auth?: string) {
  return new Request("http://localhost:3000/api/cron/expiry-reminders", {
    method: "POST",
    ...(auth ? { headers: { authorization: auth } } : {}),
  });
}

beforeEach(() => {
  mockSend.mockClear();
  mockSend.mockResolvedValue({ sent: true });
  process.env.CRON_SECRET = SECRET;
  prismaMock.classAccess.findMany.mockResolvedValue([] as never);
  prismaMock.classAccess.findFirst.mockResolvedValue(null);
});
afterEach(() => { delete process.env.CRON_SECRET; });

describe("authorisation", () => {
  it("401s without a bearer token", async () => {
    const { POST } = await import("@/app/api/cron/expiry-reminders/route");
    expect((await readJson(await POST(req()))).status).toBe(401);
  });

  it("401s on the wrong secret", async () => {
    const { POST } = await import("@/app/api/cron/expiry-reminders/route");
    expect((await readJson(await POST(req("Bearer nope")))).status).toBe(401);
  });

  it("fails closed when CRON_SECRET isn't configured at all", async () => {
    // Otherwise an unconfigured deploy would accept any caller.
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/cron/expiry-reminders/route");

    expect((await readJson(await POST(req("Bearer anything")))).status).toBe(401);
  });

  it("runs with the right secret", async () => {
    const { POST } = await import("@/app/api/cron/expiry-reminders/route");
    expect((await readJson(await POST(req(`Bearer ${SECRET}`)))).status).toBe(200);
  });
});

describe("who gets reminded", () => {
  const pass = (id: number) => ({
    id, studentId: 42, boardId: 1, classId: 5,
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
  });

  it("sends one reminder per expiring pass per stage", async () => {
    const { POST } = await import("@/app/api/cron/expiry-reminders/route");
    prismaMock.classAccess.findMany.mockResolvedValue([pass(88)] as never);

    const res = await readJson(await POST(req(`Bearer ${SECRET}`)));

    expect(res.status).toBe(200);
    // Four stages queried, each finding the same single pass in this stub.
    expect(mockSend).toHaveBeenCalledWith(88, expect.any(String));
  });

  it("skips a pass the student has already renewed past", async () => {
    // A later pass for the same scope exists, so the old one ending is not
    // news — telling them their access is about to lapse would be false.
    const { POST } = await import("@/app/api/cron/expiry-reminders/route");
    prismaMock.classAccess.findMany.mockResolvedValue([pass(88)] as never);
    prismaMock.classAccess.findFirst.mockResolvedValue({ id: 99 } as never);

    await POST(req(`Bearer ${SECRET}`));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("counts duplicates as skipped rather than failures", async () => {
    // A re-run is normal and must not look like an error in the summary.
    const { POST } = await import("@/app/api/cron/expiry-reminders/route");
    prismaMock.classAccess.findMany.mockResolvedValue([pass(88)] as never);
    mockSend.mockResolvedValue({ sent: false, reason: "duplicate" });

    const res = await readJson(await POST(req(`Bearer ${SECRET}`)));
    const stages = (res.data as { stages: Record<string, { sent: number; skipped: number; failed: number }> }).stages;

    expect(stages["T-7"]).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
  });

  it("reports a provider failure separately from a skip", async () => {
    const { POST } = await import("@/app/api/cron/expiry-reminders/route");
    prismaMock.classAccess.findMany.mockResolvedValue([pass(88)] as never);
    mockSend.mockResolvedValue({ sent: false, reason: "provider_error", error: "502" });

    const res = await readJson(await POST(req(`Bearer ${SECRET}`)));
    const stages = (res.data as { stages: Record<string, { failed: number }> }).stages;

    expect(stages["T-7"].failed).toBe(1);
  });

  it("covers all four stages", async () => {
    const { POST } = await import("@/app/api/cron/expiry-reminders/route");

    const res = await readJson(await POST(req(`Bearer ${SECRET}`)));
    const stages = (res.data as { stages: Record<string, unknown> }).stages;

    expect(Object.keys(stages).sort()).toEqual(["T-1", "T-7", "day-of", "post"]);
  });
});
