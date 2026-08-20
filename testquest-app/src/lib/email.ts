/**
 * The only way mail leaves this application.
 *
 * Provider is **Resend**, reached over its REST API rather than the SDK — one
 * `fetch` against a documented endpoint, no dependency to keep current, and
 * swapping to SES later means rewriting this one function. Templates are React
 * components rendered to static HTML by the caller; this module only ships
 * what it is handed.
 *
 * Without `RESEND_API_KEY` it logs to the console and reports `delivered:
 * true`. That keeps local dev and the whole test suite exercising the real
 * pipeline — ledger, unsubscribe gate, template rendering — without a key and
 * without sending anything to a real person.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Always required: some clients want it, and it's the fallback. */
  text: string;
  /** Rendered HTML body. */
  html?: string;
  /** RFC-8058 one-click unsubscribe, set for non-transactional mail. */
  listUnsubscribeUrl?: string;
}

export interface EmailSendResult {
  delivered: boolean;
  messageId?: string;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export function isEmailDevMode(): boolean {
  return !isEmailConfigured();
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || "Testquest <noreply@testquest.in>";
}

export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    // eslint-disable-next-line no-console
    console.log(
      `[email-dev] → ${msg.to}\n  subject: ${msg.subject}\n` +
      msg.text.split("\n").map((l) => "  " + l).join("\n") +
      (msg.html ? `\n  (html: ${msg.html.length} bytes)` : ""),
    );
    return { delivered: true, messageId: "dev-mode" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
        // Lets a mail client offer unsubscribe in its own chrome, which keeps
        // people off the "mark as spam" button.
        ...(msg.listUnsubscribeUrl
          ? {
              headers: {
                "List-Unsubscribe": `<${msg.listUnsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { delivered: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }
    const body = (await res.json()) as { id?: string };
    return { delivered: true, messageId: body.id };
  } catch (err) {
    // A provider outage must never take a request down with it — the caller
    // releases its ledger claim and the send can be retried.
    return { delivered: false, error: (err as Error).message };
  }
}
