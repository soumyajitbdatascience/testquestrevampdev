/**
 * Email shim — symmetrical to lib/sms.ts.
 *
 * Logs to console in dev. EMAIL_V2_TODO: wire a real provider (Resend / SES /
 * Postmark) before external launch. The real provider must also accept the
 * optional `html` body — see `renderBrandedEmailHtml` in `lib/notifications.ts`
 * which assembles the branded shell wrapped around the template's plain text.
 *
 * Returns delivered=true unconditionally in dev so the rest of the pipeline
 * stays exercise-able without a real provider configured.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Always required for backwards compat + downgrade fallback. */
  text: string;
  /** Optional pre-rendered HTML body (branded shell). Logged in dev,
   *  passed to the provider once one is wired. */
  html?: string;
}

export interface EmailSendResult {
  delivered: boolean;
  messageId?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  // eslint-disable-next-line no-console
  console.log(`[email-stub] → ${msg.to}\n  subject: ${msg.subject}\n  ${msg.text.split("\n").map(l => "  " + l).join("\n")}`);
  if (msg.html) {
    // Truncate HTML preview to keep dev logs readable, but log enough to
    // confirm the branded shell rendered with the right colors/logo.
    const preview = msg.html.length > 1200 ? msg.html.slice(0, 1200) + `… (+${msg.html.length - 1200} bytes)` : msg.html;
    // eslint-disable-next-line no-console
    console.log(`[email-stub] html (${msg.html.length} bytes):\n${preview}`);
  }
  return { delivered: true };
}

export function isEmailDevMode(): boolean {
  return process.env.NODE_ENV !== "production";
}
