import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { sendOnce, unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } from "@/lib/email-send";
import { sendEmail } from "@/lib/email";
import { Prisma } from "@/generated/prisma/client";

/**
 * Idempotent sending.
 *
 * Two ways this goes wrong in production and both are ugly: a cron re-run
 * emailing everyone twice, or an unsubscribed student getting marketing anyway.
 * The ledger claim and the opt-out gate are what prevent each, and they live in
 * `sendOnce` so no future template can skip them.
 */
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ delivered: true, messageId: "msg_1" })),
  isEmailConfigured: () => false,
  isEmailDevMode: () => true,
}));

const mockSend = vi.mocked(sendEmail);

const STUDENT = { email: "riya@example.com", marketingOptOut: false, isActive: true };
const base = {
  kind: "expiry_T-7", studentId: 42, refKey: "access:88",
  subject: "Your pass ends in a week", text: "body",
};

/** A duplicate ledger insert, exactly as Prisma reports a unique violation. */
function duplicateClaim() {
  prismaMock.emailSend.create.mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed on uq_email_send", {
      code: "P2002",
      clientVersion: "6.19.3",
    }),
  );
}

beforeEach(() => {
  // The provider mock is created by the module factory, so the global
  // prismaMock reset doesn't touch it — call counts would carry between tests.
  mockSend.mockClear();
  prismaMock.student.findUnique.mockResolvedValue(STUDENT as never);
  prismaMock.emailSend.create.mockResolvedValue({ id: 1 } as never);
  prismaMock.emailSend.updateMany.mockResolvedValue({ count: 1 } as never);
  prismaMock.emailSend.deleteMany.mockResolvedValue({ count: 1 } as never);
  mockSend.mockResolvedValue({ delivered: true, messageId: "msg_1" });
});

describe("exactly once", () => {
  it("sends when the ledger claim succeeds", async () => {
    const r = await sendOnce(base);

    expect(r).toMatchObject({ sent: true, messageId: "msg_1" });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("claims the ledger BEFORE calling the provider", async () => {
    // Sending first and recording after double-sends whenever the process dies
    // in between — the exact failure a retrying cron eventually hits.
    const order: string[] = [];
    prismaMock.emailSend.create.mockImplementation((async () => { order.push("claim"); return { id: 1 }; }) as never);
    mockSend.mockImplementation((async () => { order.push("send"); return { delivered: true }; }) as never);

    await sendOnce(base);

    expect(order).toEqual(["claim", "send"]);
  });

  it("a duplicate claim skips the send entirely", async () => {
    duplicateClaim();

    const r = await sendOnce(base);

    expect(r).toEqual({ sent: false, reason: "duplicate" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("a cron re-run over the same window sends nothing new", async () => {
    await sendOnce(base);
    expect(mockSend).toHaveBeenCalledTimes(1);

    duplicateClaim(); // second run: the row is already there
    const second = await sendOnce(base);

    expect(second).toEqual({ sent: false, reason: "duplicate" });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("keys on kind + student + ref, so a different stage still sends", async () => {
    await sendOnce(base);
    const data = prismaMock.emailSend.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({ kind: "expiry_T-7", studentId: 42, refKey: "access:88" });
  });

  it("releases the claim when the provider fails, so a retry can send", async () => {
    mockSend.mockResolvedValue({ delivered: false, error: "Resend 502" });

    const r = await sendOnce(base);

    expect(r).toMatchObject({ sent: false, reason: "provider_error" });
    // An undelivered email must not be remembered as sent.
    expect(prismaMock.emailSend.deleteMany).toHaveBeenCalled();
  });

  it("records the provider message id on success", async () => {
    await sendOnce(base);
    const data = prismaMock.emailSend.updateMany.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({ providerMessageId: "msg_1" });
  });
});

describe("unsubscribe gate", () => {
  it("suppresses lifecycle mail for an opted-out student", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ ...STUDENT, marketingOptOut: true } as never);

    const r = await sendOnce(base);

    expect(r).toEqual({ sent: false, reason: "unsubscribed" });
    expect(mockSend).not.toHaveBeenCalled();
    // Nothing claimed either — the send may become valid again if they resubscribe.
    expect(prismaMock.emailSend.create).not.toHaveBeenCalled();
  });

  it("still sends a receipt to an opted-out student", async () => {
    // A receipt is a record of a payment, not marketing.
    prismaMock.student.findUnique.mockResolvedValue({ ...STUDENT, marketingOptOut: true } as never);

    const r = await sendOnce({ ...base, kind: "receipt", transactional: true });

    expect(r).toMatchObject({ sent: true });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("still sends verification to an opted-out student", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ ...STUDENT, marketingOptOut: true } as never);

    expect(await sendOnce({ ...base, kind: "verification", transactional: true })).toMatchObject({ sent: true });
  });

  it("attaches a one-click unsubscribe header to lifecycle mail only", async () => {
    await sendOnce(base);
    expect(mockSend.mock.calls[0][0].listUnsubscribeUrl).toContain("/unsubscribe?s=42");

    mockSend.mockClear();
    await sendOnce({ ...base, transactional: true });
    expect(mockSend.mock.calls[0][0].listUnsubscribeUrl).toBeUndefined();
  });

  it("does not send to a deactivated or address-less account", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ ...STUDENT, isActive: false } as never);
    expect(await sendOnce(base)).toEqual({ sent: false, reason: "no_recipient" });

    prismaMock.student.findUnique.mockResolvedValue(null);
    expect(await sendOnce(base)).toEqual({ sent: false, reason: "no_recipient" });
  });
});

describe("signed unsubscribe links", () => {
  it("round-trips its own token", () => {
    expect(verifyUnsubscribeToken(42, unsubscribeToken(42))).toBe(true);
  });

  it("rejects a tampered token", () => {
    const t = unsubscribeToken(42);
    expect(verifyUnsubscribeToken(42, t.slice(0, -2) + "00")).toBe(false);
    expect(verifyUnsubscribeToken(42, "")).toBe(false);
  });

  it("rejects another student's token — one link, one account", () => {
    expect(verifyUnsubscribeToken(43, unsubscribeToken(42))).toBe(false);
  });

  it("builds a link carrying both id and signature", () => {
    const url = unsubscribeUrl(42);
    expect(url).toContain("s=42");
    expect(url).toContain(`t=${unsubscribeToken(42)}`);
  });
});
