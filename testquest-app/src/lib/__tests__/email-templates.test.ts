import { describe, expect, it } from "vitest";
import { buildReceipt, buildExpiryReminder, buildVerification } from "@/emails/templates";

/**
 * Template content.
 *
 * A receipt is a financial record: if it disagrees with what was charged, the
 * student is right and we are wrong. So these tests check the numbers reach the
 * page intact, converted exactly once from the paise the order row stores.
 */
const RECEIPT = {
  name: "Riya",
  orderId: 412,
  amount: 100000,      // ₹1,000 list
  discount: 25000,     // ₹250 off
  finalAmount: 75000,  // ₹750 paid
  couponCode: "LAUNCH25",
  paymentRef: "pay_abc123",
  boardName: "CBSE",
  className: "Class 9",
  durationMonths: 3,
  expiresAt: new Date("2026-11-16T00:00:00Z"),
  purchasedAt: new Date("2026-08-16T00:00:00Z"),
  dashboardUrl: "https://testquest.in/dashboard",
};

describe("receipt", () => {
  it("renders paise as rupees, converted once", async () => {
    const mail = await buildReceipt(RECEIPT);

    expect(mail.html).toContain("₹1,000"); // amount
    expect(mail.html).toContain("₹750");   // final
    expect(mail.html).toContain("₹250");   // discount
    // The raw paise must never appear — that would be the 100× bug in an inbox.
    expect(mail.html).not.toContain("100000");
    expect(mail.html).not.toContain("75000");
  });

  it("states the validity date and that nothing renews", async () => {
    const mail = await buildReceipt(RECEIPT);

    expect(mail.html).toContain("16 November 2026");
    expect(mail.html.toLowerCase()).toContain("one-time payment");
    expect(mail.text.toLowerCase()).toContain("no auto-renewal");
  });

  it("names the coupon that was applied", async () => {
    expect((await buildReceipt(RECEIPT)).html).toContain("LAUNCH25");
  });

  it("omits the discount row when nothing was discounted", async () => {
    const mail = await buildReceipt({ ...RECEIPT, discount: 0, finalAmount: 100000, couponCode: null });

    expect(mail.html).not.toContain("Discount");
    expect(mail.text).not.toContain("Discount");
  });

  it("carries the payment reference for support to trace", async () => {
    expect((await buildReceipt(RECEIPT)).text).toContain("pay_abc123");
  });

  it("puts the scope and order number in the subject", async () => {
    const mail = await buildReceipt(RECEIPT);
    expect(mail.subject).toContain("CBSE · Class 9");
    expect(mail.subject).toContain("#412");
  });

  it("has no unsubscribe footer — a receipt is not marketing", async () => {
    expect((await buildReceipt(RECEIPT)).html).not.toContain("Unsubscribe");
  });

  it("always ships text alongside html", async () => {
    const mail = await buildReceipt(RECEIPT);
    expect(mail.text.length).toBeGreaterThan(50);
    expect(mail.html).toContain("<!doctype html>");
  });
});

describe("expiry reminders", () => {
  const base = {
    name: "Riya", boardName: "CBSE", className: "Class 9",
    expiresAt: new Date("2026-11-16T00:00:00Z"),
    renewUrl: "https://testquest.in/my-subscriptions",
    unsubscribeUrl: "https://testquest.in/unsubscribe?s=42&t=abc",
  };

  it("each stage has its own subject", async () => {
    const built = await Promise.all((["T-7", "T-1", "day-of", "post"] as const)
      .map((stage) => buildExpiryReminder({ ...base, stage })));
    const subjects = built.map((m) => m.subject);

    expect(new Set(subjects).size).toBe(4);
  });

  it("explains that renewing adds to the end, never restarts", async () => {
    const mail = await buildExpiryReminder({ ...base, stage: "T-7" });
    expect(mail.html).toContain("adds time to the end");
  });

  it("speaks in the past tense once the pass has ended", async () => {
    const mail = await buildExpiryReminder({ ...base, stage: "post" });
    expect(mail.text).toContain("ended on");
  });

  it("carries an unsubscribe link — this one is marketing", async () => {
    const { html } = await buildExpiryReminder({ ...base, stage: "T-1" });

    // The `&` is escaped in the href, which is correct HTML and still resolves
    // to the same URL in every client.
    expect(html).toContain("https://testquest.in/unsubscribe?s=42&amp;t=abc");
    expect(html).toContain("Unsubscribe from these reminders");
  });
});

describe("verification", () => {
  it("leads with the link and nothing else to do", async () => {
    const mail = await buildVerification({ name: "Riya", verifyUrl: "https://testquest.in/verify-email?token=xyz" });

    expect(mail.html).toContain("https://testquest.in/verify-email?token=xyz");
    expect(mail.html).not.toContain("Unsubscribe");
  });
});
