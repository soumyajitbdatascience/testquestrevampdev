/**
 * Notification dispatcher — Phase 2 / Task 2.6.
 *
 * One API for every transactional message: OTPs, invites, assignments, etc.
 *
 *   sendNotification({template, params, recipient, channels?})
 *     → Picks the FIRST channel in preference order that's (a) requested
 *       or in the default order, (b) eligible for the template, and (c)
 *       has a working address on the recipient. Sends once. Used for
 *       single-channel transactions like OTPs.
 *
 *   sendNotificationBroadcast({template, params, recipient, channels})
 *     → Sends across EVERY eligible+addressable channel. Used for things
 *       like assignment notifications where redundancy is fine.
 *
 * Why a registry of templates: keeps message copy centralised + lets each
 * channel get its own rendering (SMS is brief, email has subject + body,
 * WhatsApp can carry richer text). It also makes future per-org template
 * customisation straightforward to layer on top.
 *
 * Provider implementations live in `lib/whatsapp.ts`, `lib/sms.ts`,
 * `lib/email.ts`. Direct calls to those from service code are deprecated
 * after this ticket — go through `sendNotification` instead.
 */

import { sendWhatsapp, isWhatsappReachable } from "@/lib/whatsapp";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";

// ─── Channels ──────────────────────────────────────────────────────

export type Channel = "whatsapp" | "sms" | "email";
const DEFAULT_ORDER: readonly Channel[] = ["whatsapp", "sms", "email"];

// ─── Recipient ─────────────────────────────────────────────────────

export interface Recipient {
  mobile?: string | null;
  email?: string | null;
  /** Override for the WhatsApp reachability check. Defaults to true when
   *  mobile is present. Real opt-out tracking will land via `isWhatsappReachable`. */
  hasWhatsapp?: boolean;
  /** Optional white-label branding applied to the HTML shell when this
   *  recipient is reached over email. Plain-text body and SMS/WhatsApp are
   *  unchanged. See `buildEmailBranding` in `lib/branding-for-email.ts`. */
  branding?: EmailBranding;
}

/**
 * Branding context for the HTML email shell. All fields optional — undefined
 * fields fall back to the default Testquest palette / wordmark / support copy.
 *
 * The shape is intentionally provider-neutral: `logoUrl` is rendered as a
 * plain `<img src>` so Gmail/Outlook/Apple Mail all handle it. `primaryColor`
 * is trusted as-is (validation happens upstream in the branding API).
 */
export interface EmailBranding {
  orgName?: string;
  displayName?: string;
  logoUrl?: string;       // absolute URL preferred (used as <img src>)
  primaryColor?: string;  // CSS color string
  supportEmail?: string;
  supportPhone?: string;
}

// ─── Branded HTML email shell ──────────────────────────────────────

const DEFAULT_PRIMARY = "#e89b3c";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape, then linkify bare http(s) URLs. Order matters: escape first so we
 *  never produce a script vector via the URL itself. */
function escapeAndLinkify(s: string, linkColor: string): string {
  const escaped = escapeHtml(s);
  return escaped.replace(/(https?:\/\/[^\s<>"']+)/g, (url) =>
    `<a href="${url}" style="color:${linkColor};text-decoration:underline;">${url}</a>`,
  );
}

/**
 * Render a minimal branded HTML email shell around the template's plain text.
 *
 * - 600px white card on neutral grey, Inter/sans fallback
 * - Header band coloured with the org's primaryColor (or Testquest gold)
 * - Logo `<img>` if URL provided, otherwise the displayName/Testquest wordmark
 * - Footer with org support contact (if provided), Testquest mark, and a
 *   "Powered by Testquest" line.
 *
 * Pro-tier "hide Powered by" — for now we always render it. Task 3.7 will
 * wire the per-plan toggle. Heuristic-based hiding was considered (hide when
 * both logo + colour are set) but rejected as too implicit; an explicit
 * subscription-state check belongs in 3.7's branding-allowed gate.
 */
export function renderBrandedEmailHtml(
  rendered: RenderedEmail,
  branding?: EmailBranding,
): string {
  const primary = branding?.primaryColor || DEFAULT_PRIMARY;
  const displayName = branding?.displayName || branding?.orgName || "Testquest";
  const supportEmail = branding?.supportEmail;
  const supportPhone = branding?.supportPhone;

  const logoHtml = branding?.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(displayName)}" style="max-height:40px;max-width:200px;display:block;border:0;outline:none;" />`
    : `<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${escapeHtml(displayName)}</span>`;

  const paragraphs = rendered.text
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
    .map((para) => {
      // Preserve single-newlines inside a paragraph as <br>.
      const inner = para
        .split("\n")
        .map((line) => escapeAndLinkify(line, primary))
        .join("<br>");
      return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#222222;">${inner}</p>`;
    })
    .join("");

  const supportLines: string[] = [];
  if (supportEmail) {
    supportLines.push(
      `<a href="mailto:${escapeHtml(supportEmail)}" style="color:#555555;text-decoration:none;">${escapeHtml(supportEmail)}</a>`,
    );
  }
  if (supportPhone) supportLines.push(escapeHtml(supportPhone));
  const supportBlock = supportLines.length > 0
    ? `<p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#888888;">Questions? ${supportLines.join(" · ")}</p>`
    : "";

  // "Powered by Testquest" — Task 3.7 will hide for Pro plans.
  const poweredBy = `<p style="margin:6px 0 0 0;font-size:11px;color:#aaaaaa;">Powered by Testquest</p>`;
  const testquestMark = branding ? "" : `<p style="margin:0 0 6px 0;font-size:12px;color:#888888;">— Testquest</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(rendered.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td style="background:${primary};padding:20px 28px;">${logoHtml}</td></tr>
<tr><td style="padding:28px;">${paragraphs}</td></tr>
<tr><td style="padding:18px 28px 24px 28px;border-top:1px solid #eeeeee;">
${supportBlock}${testquestMark}${poweredBy}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Templates ─────────────────────────────────────────────────────

/** What every render returns. Email has subject+body; SMS/WhatsApp use `text`. */
type RenderedSms = { text: string };
type RenderedEmail = { subject: string; text: string };

/** Internal: maps a template id to its params + per-channel renderers. */
interface TemplateDef<P> {
  id: string;
  eligibleChannels: readonly Channel[];
  whatsapp?: (p: P) => RenderedSms;
  sms?: (p: P) => RenderedSms;
  email?: (p: P) => RenderedEmail;
}

// All template param shapes ----------------------------------------------------

export interface JoinOtpParams   { code: string; centreName?: string; ttlMinutes: number }
export interface LoginOtpParams  { code: string; centreName?: string; ttlMinutes: number }
export interface TeamInviteParams {
  inviteeFirstName: string;
  orgName: string;
  role: "TEACHER" | "ADMIN";
  url: string;
  ttlDays: number;
  /** True if this is a re-send rather than the first invite. */
  isReminder?: boolean;
}
export interface WelcomeParams {
  ownerFirstName: string;
  orgName: string;
  url: string;
  ttlDays: number;
  isReminder?: boolean;
}
export interface AssignmentNewParams {
  orgName: string;
  testName: string;
  dueText?: string; // "Due 12 Jun" — caller pre-formats
  link: string;
}
export interface AssignmentReminderParams {
  orgName: string;
  testName: string;
  dueText?: string;
  link: string;
}
export interface ParentReportReadyParams {
  studentFirstName: string;
  orgName: string;
  url: string;
}

// Template definitions --------------------------------------------------------

const TEMPLATES = {
  "join-otp": {
    id: "join-otp",
    eligibleChannels: ["whatsapp", "sms"] as const,
    whatsapp: (p: JoinOtpParams) => ({
      text: p.centreName
        ? `${p.code} is your Testquest verification code for ${p.centreName}. Valid for ${p.ttlMinutes} minutes.`
        : `${p.code} is your Testquest verification code. Valid for ${p.ttlMinutes} minutes.`,
    }),
    sms: (p: JoinOtpParams) => ({
      text: p.centreName
        ? `${p.code} is your Testquest verification code for ${p.centreName}. Valid for ${p.ttlMinutes} minutes.`
        : `${p.code} is your Testquest verification code. Valid for ${p.ttlMinutes} minutes.`,
    }),
  } satisfies TemplateDef<JoinOtpParams>,

  "login-otp": {
    id: "login-otp",
    eligibleChannels: ["whatsapp", "sms"] as const,
    whatsapp: (p: LoginOtpParams) => ({
      text: p.centreName
        ? `${p.code} is your Testquest sign-in code for ${p.centreName}. Valid for ${p.ttlMinutes} minutes.`
        : `${p.code} is your Testquest sign-in code. Valid for ${p.ttlMinutes} minutes.`,
    }),
    sms: (p: LoginOtpParams) => ({
      text: p.centreName
        ? `${p.code} is your Testquest sign-in code for ${p.centreName}. Valid for ${p.ttlMinutes} minutes.`
        : `${p.code} is your Testquest sign-in code. Valid for ${p.ttlMinutes} minutes.`,
    }),
  } satisfies TemplateDef<LoginOtpParams>,

  "team-invite": {
    id: "team-invite",
    eligibleChannels: ["email"] as const,
    email: (p: TeamInviteParams) => ({
      subject: p.isReminder
        ? `Reminder: ${p.orgName} is waiting for you on Testquest`
        : `${p.orgName} invited you to Testquest`,
      text:
        `Hi ${p.inviteeFirstName},\n\n` +
        (p.isReminder
          ? `Your invite is still active. Set your password to get started: ${p.url}\n\n`
          : `${p.orgName} added you as a ${p.role.toLowerCase()} on Testquest. ` +
            `Set your password and get started: ${p.url}\n\n` +
            `This link expires in ${p.ttlDays} days.\n\n`) +
        `— Testquest`,
    }),
  } satisfies TemplateDef<TeamInviteParams>,

  "welcome": {
    id: "welcome",
    eligibleChannels: ["email"] as const,
    email: (p: WelcomeParams) => ({
      subject: p.isReminder
        ? `Reminder: ${p.orgName} is ready to set up on Testquest`
        : `Welcome to Testquest — ${p.orgName} is ready to set up`,
      text:
        `Hi ${p.ownerFirstName},\n\n` +
        (p.isReminder
          ? `Your welcome link is still active. Set your password to get started:\n\n${p.url}\n\n`
          : `${p.orgName} has been set up on Testquest by our team. ` +
            `Click below to set your password and finish onboarding:\n\n${p.url}\n\n` +
            `This link expires in ${p.ttlDays} days.\n\n`) +
        `— Testquest`,
    }),
  } satisfies TemplateDef<WelcomeParams>,

  "assignment-new": {
    id: "assignment-new",
    eligibleChannels: ["whatsapp", "sms", "email"] as const,
    whatsapp: (p: AssignmentNewParams) => ({
      text: `${p.orgName}: New test "${p.testName}"${p.dueText ? ` ${p.dueText}.` : ""} Open ${p.link}`,
    }),
    sms: (p: AssignmentNewParams) => ({
      text: `${p.orgName}: New test "${p.testName}"${p.dueText ? ` ${p.dueText}.` : ""} Open ${p.link}`,
    }),
    email: (p: AssignmentNewParams) => ({
      subject: `New test from ${p.orgName}: ${p.testName}`,
      text: `${p.orgName} has assigned you a new test: ${p.testName}.${p.dueText ? ` ${p.dueText}.` : ""}\n\nOpen it: ${p.link}`,
    }),
  } satisfies TemplateDef<AssignmentNewParams>,

  "assignment-reminder": {
    id: "assignment-reminder",
    eligibleChannels: ["whatsapp", "sms"] as const,
    whatsapp: (p: AssignmentReminderParams) => ({
      text: `${p.orgName}: Reminder — please finish "${p.testName}"${p.dueText ? ` (${p.dueText})` : ""}. ${p.link}`,
    }),
    sms: (p: AssignmentReminderParams) => ({
      text: `${p.orgName}: Reminder — please finish "${p.testName}"${p.dueText ? ` (${p.dueText})` : ""}. ${p.link}`,
    }),
  } satisfies TemplateDef<AssignmentReminderParams>,

  "parent-report-ready": {
    id: "parent-report-ready",
    eligibleChannels: ["whatsapp", "sms", "email"] as const,
    whatsapp: (p: ParentReportReadyParams) => ({
      text: `${p.orgName}: New parent report for ${p.studentFirstName}. View: ${p.url}`,
    }),
    sms: (p: ParentReportReadyParams) => ({
      text: `${p.orgName}: New parent report for ${p.studentFirstName}. View: ${p.url}`,
    }),
    email: (p: ParentReportReadyParams) => ({
      subject: `Your child's progress report from ${p.orgName}`,
      text:
        `Hi parents,\n\n` +
        `${p.orgName} prepared a progress report for ${p.studentFirstName}. ` +
        `View it here: ${p.url}\n\n` +
        `— Testquest`,
    }),
  } satisfies TemplateDef<ParentReportReadyParams>,
} as const;

export type TemplateId = keyof typeof TEMPLATES;

/** Strongly-typed params per template id. */
type ParamsOf<T extends TemplateId> =
  T extends "join-otp" ? JoinOtpParams
  : T extends "login-otp" ? LoginOtpParams
  : T extends "team-invite" ? TeamInviteParams
  : T extends "welcome" ? WelcomeParams
  : T extends "assignment-new" ? AssignmentNewParams
  : T extends "assignment-reminder" ? AssignmentReminderParams
  : T extends "parent-report-ready" ? ParentReportReadyParams
  : never;

// ─── Single dispatch ───────────────────────────────────────────────

export interface NotificationResult {
  /** Channel that actually delivered; null if nothing was reachable. */
  channel: Channel | null;
  delivered: boolean;
  messageId?: string;
  /** Reason for skip when channel === null. */
  reason?: "no_channel" | "ineligible";
}

interface SendArgs<T extends TemplateId> {
  template: T;
  params: ParamsOf<T>;
  recipient: Recipient;
  /** Preferred channel order. Defaults to whatsapp → sms → email. */
  channels?: readonly Channel[];
}

async function canReach(channel: Channel, recipient: Recipient): Promise<boolean> {
  if (channel === "email") return !!(recipient.email && recipient.email.includes("@"));
  if (!recipient.mobile || recipient.mobile.replace(/\D+/g, "").length < 10) return false;
  if (channel === "whatsapp") {
    if (recipient.hasWhatsapp === false) return false;
    return await isWhatsappReachable(recipient.mobile);
  }
  // sms
  return true;
}

async function deliverViaChannel<T extends TemplateId>(
  channel: Channel,
  template: T,
  params: ParamsOf<T>,
  recipient: Recipient,
): Promise<NotificationResult> {
  const def = TEMPLATES[template] as unknown as TemplateDef<ParamsOf<T>>;

  if (channel === "email") {
    if (!def.email) return { channel: null, delivered: false, reason: "ineligible" };
    const r = def.email(params);
    // Always wrap in the branded HTML shell. When the recipient has no
    // branding the shell falls back to the default Testquest palette, so
    // B2C / sales-led-pre-setup emails still get a polished HTML body.
    const html = renderBrandedEmailHtml(r, recipient.branding);
    const out = await sendEmail({ to: recipient.email!, subject: r.subject, text: r.text, html });
    return { channel, delivered: out.delivered, messageId: out.messageId };
  }
  if (channel === "whatsapp") {
    if (!def.whatsapp) return { channel: null, delivered: false, reason: "ineligible" };
    const r = def.whatsapp(params);
    const out = await sendWhatsapp({ mobile: recipient.mobile!, message: r.text });
    return { channel, delivered: out.delivered, messageId: out.messageId };
  }
  // sms
  if (!def.sms) return { channel: null, delivered: false, reason: "ineligible" };
  const r = def.sms(params);
  const out = await sendSms({ mobile: recipient.mobile!, message: r.text });
  return { channel, delivered: out.delivered, messageId: out.messageId };
}

export async function sendNotification<T extends TemplateId>(args: SendArgs<T>): Promise<NotificationResult> {
  const def = TEMPLATES[args.template] as unknown as TemplateDef<ParamsOf<T>>;
  const order = args.channels ?? DEFAULT_ORDER;
  const eligible = new Set<Channel>(def.eligibleChannels as readonly Channel[]);

  for (const c of order) {
    if (!eligible.has(c)) continue;
    if (!(await canReach(c, args.recipient))) continue;
    const r = await deliverViaChannel(c, args.template, args.params, args.recipient);
    // eslint-disable-next-line no-console
    console.log(`[notifications] template=${args.template} channel=${r.channel} delivered=${r.delivered}`);
    return r;
  }
  // eslint-disable-next-line no-console
  console.log(`[notifications] template=${args.template} channel=null reason=no_channel`);
  return { channel: null, delivered: false, reason: "no_channel" };
}

// ─── Broadcast (fan-out) ───────────────────────────────────────────

interface BroadcastArgs<T extends TemplateId> {
  template: T;
  params: ParamsOf<T>;
  recipient: Recipient;
  /** Channels to try. ALL eligible+reachable ones get hit. */
  channels: readonly Channel[];
}

export interface BroadcastResult {
  results: NotificationResult[];
  delivered: number;
  skipped: number;
}

export async function sendNotificationBroadcast<T extends TemplateId>(args: BroadcastArgs<T>): Promise<BroadcastResult> {
  const def = TEMPLATES[args.template] as unknown as TemplateDef<ParamsOf<T>>;
  const eligible = new Set<Channel>(def.eligibleChannels as readonly Channel[]);
  const results: NotificationResult[] = [];
  for (const c of args.channels) {
    if (!eligible.has(c)) { results.push({ channel: null, delivered: false, reason: "ineligible" }); continue; }
    if (!(await canReach(c, args.recipient))) { results.push({ channel: null, delivered: false, reason: "no_channel" }); continue; }
    results.push(await deliverViaChannel(c, args.template, args.params, args.recipient));
  }
  const delivered = results.filter((r) => r.delivered).length;
  // eslint-disable-next-line no-console
  console.log(`[notifications] broadcast template=${args.template} delivered=${delivered}/${args.channels.length}`);
  return { results, delivered, skipped: args.channels.length - delivered };
}
