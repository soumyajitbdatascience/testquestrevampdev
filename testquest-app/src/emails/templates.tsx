/**
 * The eight lifecycle emails.
 *
 * Each template exports a `build*` function returning `{ subject, text, html }`
 * — HTML for the inbox, plain text for the clients and screen readers that
 * want it, and both always in step because they are produced together.
 *
 * Money is never computed here. Receipts are handed paise straight from the
 * order row and formatted through `money.ts`, the only conversion site in the
 * app; a template doing its own arithmetic is how a receipt ends up disagreeing
 * with what was charged.
 */
import * as React from "react";
import { EmailLayout, Row, BRAND } from "@/emails/layout";
import { formatPaise } from "@/lib/money";

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * `react-dom/server` is imported *inside* the call rather than at module scope.
 * Next refuses a static import of it anywhere reachable from a route's module
 * graph — the cron route 500s at compile with it hoisted, even though the code
 * only ever runs on the server and both tsc and the unit tests pass. Deferring
 * it keeps the templates as React while keeping the routes buildable.
 */
async function render(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return `<!doctype html>${renderToStaticMarkup(el)}`;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

// ── Transactional ─────────────────────────────────────────────────────────

export async function buildVerification(opts: { name: string; verifyUrl: string }): Promise<BuiltEmail> {
  return {
    subject: "Confirm your email address",
    text: `Hi ${opts.name},\n\nConfirm your email to finish setting up your Testquest account:\n${opts.verifyUrl}\n\nIf you didn't sign up, ignore this email.`,
    html: await render(
      <EmailLayout
        preview="One tap to confirm your email"
        heading="Confirm your email"
        cta={{ label: "Confirm email", url: opts.verifyUrl }}
      >
        <p style={{ margin: 0 }}>Hi {opts.name},</p>
        <p>Confirm your email address to finish setting up your account.</p>
        <p style={{ color: BRAND.muted, fontSize: 13 }}>If you didn&rsquo;t sign up for Testquest, you can ignore this.</p>
      </EmailLayout>,
    ),
  };
}

export async function buildPasswordReset(opts: { name: string; resetUrl: string }): Promise<BuiltEmail> {
  return {
    subject: "Reset your Testquest password",
    text: `Hi ${opts.name},\n\nReset your password here (the link expires in 1 hour):\n${opts.resetUrl}\n\nIf you didn't ask for this, ignore this email — your password hasn't changed.`,
    html: await render(
      <EmailLayout
        preview="Reset your password"
        heading="Reset your password"
        cta={{ label: "Choose a new password", url: opts.resetUrl }}
      >
        <p style={{ margin: 0 }}>Hi {opts.name},</p>
        <p>Use the button below to set a new password. The link expires in an hour.</p>
        <p style={{ color: BRAND.muted, fontSize: 13 }}>
          If you didn&rsquo;t ask for this, ignore it — your password hasn&rsquo;t changed.
        </p>
      </EmailLayout>,
    ),
  };
}

export interface ReceiptInput {
  name: string;
  orderId: number;
  /** Paise, straight off tq_orders. */
  amount: number;
  discount: number;
  finalAmount: number;
  couponCode: string | null;
  paymentRef: string | null;
  boardName: string;
  className: string;
  durationMonths: number;
  /** From the granted ClassAccess row. */
  expiresAt: Date;
  purchasedAt: Date;
  dashboardUrl: string;
}

export async function buildReceipt(o: ReceiptInput): Promise<BuiltEmail> {
  const scope = `${o.boardName} · ${o.className}`;
  const lines = [
    `Hi ${o.name},`,
    ``,
    `Your ${o.durationMonths}-month pass for ${scope} is active.`,
    ``,
    `Order #${o.orderId} · ${fmtDate(o.purchasedAt)}`,
    `Pass price: ${formatPaise(o.amount)}`,
    ...(o.discount > 0 ? [`Discount${o.couponCode ? ` (${o.couponCode})` : ""}: −${formatPaise(o.discount)}`] : []),
    `Paid: ${formatPaise(o.finalAmount)}`,
    ...(o.paymentRef ? [`Payment reference: ${o.paymentRef}`] : []),
    ``,
    `Valid until ${fmtDate(o.expiresAt)}. One-time payment — there is no auto-renewal.`,
    ``,
    o.dashboardUrl,
  ];

  return {
    subject: `Your ${scope} pass is active — receipt for order #${o.orderId}`,
    text: lines.join("\n"),
    html: await render(
      <EmailLayout
        preview={`${o.durationMonths}-month pass for ${scope}, valid until ${fmtDate(o.expiresAt)}`}
        heading="You're in — here's your receipt"
        cta={{ label: "Start studying", url: o.dashboardUrl }}
      >
        <p style={{ margin: 0 }}>Hi {o.name},</p>
        <p>
          Your <strong>{o.durationMonths}-month pass</strong> for {scope} is active. Every subject,
          test and video in that class is unlocked.
        </p>

        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}
               style={{ marginTop: 16, backgroundColor: BRAND.wash, borderRadius: 10, padding: "8px 14px" }}>
          <tbody>
            <Row label={`Order #${o.orderId}`} value={fmtDate(o.purchasedAt)} />
            <Row label="Pass price" value={formatPaise(o.amount)} />
            {o.discount > 0 && (
              <Row label={o.couponCode ? `Discount (${o.couponCode})` : "Discount"} value={`− ${formatPaise(o.discount)}`} />
            )}
            <Row label="Paid" value={formatPaise(o.finalAmount)} strong />
            {o.paymentRef && <Row label="Payment ref" value={o.paymentRef} />}
          </tbody>
        </table>

        <p style={{ marginTop: 16 }}>
          <strong>Valid until {fmtDate(o.expiresAt)}.</strong> This was a one-time payment — nothing
          renews automatically, and you won&rsquo;t be charged again.
        </p>
      </EmailLayout>,
    ),
  };
}

export async function buildWelcome(opts: { name: string; dashboardUrl: string; unsubscribeUrl: string }): Promise<BuiltEmail> {
  return {
    subject: "Welcome to Testquest",
    text: `Hi ${opts.name},\n\nYour account is ready. Pick your board and class, then try a free sample test in any subject — no payment needed.\n\n${opts.dashboardUrl}`,
    html: await render(
      <EmailLayout
        preview="Try a free sample test in any subject"
        heading="Welcome to Testquest"
        cta={{ label: "Open my dashboard", url: opts.dashboardUrl }}
        unsubscribeUrl={opts.unsubscribeUrl}
      >
        <p style={{ margin: 0 }}>Hi {opts.name},</p>
        <p>
          Your account is ready. Every subject in your class has a <strong>free sample test</strong> —
          sit one before you decide about anything else.
        </p>
      </EmailLayout>,
    ),
  };
}

// ── Lifecycle (all respect the unsubscribe preference) ────────────────────

export type ExpiryStage = "T-7" | "T-1" | "day-of" | "post";

const EXPIRY_COPY: Record<ExpiryStage, { subject: (s: string) => string; heading: string; lead: string }> = {
  "T-7": {
    subject: (s) => `Your ${s} pass ends in a week`,
    heading: "A week left on your pass",
    lead: "Renewing now adds time to the end of your current pass — you don't lose the days you've already paid for.",
  },
  "T-1": {
    subject: (s) => `Your ${s} pass ends tomorrow`,
    heading: "Your pass ends tomorrow",
    lead: "Renew today and your access continues without a gap.",
  },
  "day-of": {
    subject: (s) => `Your ${s} pass ends today`,
    heading: "Your pass ends today",
    lead: "After today, tests and videos in this class go back to locked — your progress and results stay saved.",
  },
  post: {
    subject: (s) => `Pick up where you left off in ${s}`,
    heading: "Your pass has ended",
    lead: "Your scores and history are all still here. Renew whenever you're ready and everything unlocks again.",
  },
};

export async function buildExpiryReminder(opts: {
  name: string;
  stage: ExpiryStage;
  boardName: string;
  className: string;
  expiresAt: Date;
  renewUrl: string;
  unsubscribeUrl: string;
}): Promise<BuiltEmail> {
  const scope = `${opts.boardName} · ${opts.className}`;
  const copy = EXPIRY_COPY[opts.stage];
  const dateLine = opts.stage === "post"
    ? `Your pass ended on ${fmtDate(opts.expiresAt)}.`
    : `Your pass is valid until ${fmtDate(opts.expiresAt)}.`;

  return {
    subject: copy.subject(scope),
    text: `Hi ${opts.name},\n\n${dateLine}\n${copy.lead}\n\nRenew: ${opts.renewUrl}`,
    html: await render(
      <EmailLayout
        preview={dateLine}
        heading={copy.heading}
        cta={{ label: "Renew my pass", url: opts.renewUrl }}
        unsubscribeUrl={opts.unsubscribeUrl}
      >
        <p style={{ margin: 0 }}>Hi {opts.name},</p>
        <p>{dateLine} ({scope})</p>
        <p>{copy.lead}</p>
      </EmailLayout>,
    ),
  };
}

export async function buildUnfinishedTest(opts: {
  name: string; testName: string; answered: number; total: number;
  resumeUrl: string; unsubscribeUrl: string;
}): Promise<BuiltEmail> {
  return {
    subject: `You're ${opts.answered} of ${opts.total} questions into ${opts.testName}`,
    text: `Hi ${opts.name},\n\nYou left "${opts.testName}" partway through — ${opts.answered} of ${opts.total} answered. It's still exactly where you left it.\n\n${opts.resumeUrl}`,
    html: await render(
      <EmailLayout
        preview={`${opts.answered} of ${opts.total} answered — pick it back up`}
        heading="Finish what you started"
        cta={{ label: "Resume the test", url: opts.resumeUrl }}
        unsubscribeUrl={opts.unsubscribeUrl}
      >
        <p style={{ margin: 0 }}>Hi {opts.name},</p>
        <p>
          You&rsquo;re <strong>{opts.answered} of {opts.total}</strong> questions into &ldquo;{opts.testName}&rdquo;.
          It&rsquo;s saved exactly where you left it — same questions, same order.
        </p>
      </EmailLayout>,
    ),
  };
}

export async function buildIdleWinBack(opts: {
  name: string; days: number; dashboardUrl: string; unsubscribeUrl: string;
}): Promise<BuiltEmail> {
  return {
    subject: "Your next test is waiting",
    text: `Hi ${opts.name},\n\nIt's been ${opts.days} days. One test is usually enough to get going again.\n\n${opts.dashboardUrl}`,
    html: await render(
      <EmailLayout
        preview="One test is enough to get going again"
        heading="Your next test is waiting"
        cta={{ label: "Pick a test", url: opts.dashboardUrl }}
        unsubscribeUrl={opts.unsubscribeUrl}
      >
        <p style={{ margin: 0 }}>Hi {opts.name},</p>
        <p>It&rsquo;s been {opts.days} days since your last test. One paper is usually enough to get the habit back.</p>
      </EmailLayout>,
    ),
  };
}
