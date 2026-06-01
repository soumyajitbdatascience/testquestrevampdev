/**
 * WhatsApp Business provider shim — Phase 2 / Task 2.6.
 *
 * No real provider is wired up yet. In dev we just log the payload.
 *
 * WHATSAPP_V2_TODO: wire a real provider (Gupshup / MSG91 / Meta WABA / etc.)
 * before any external launch. The shape mirrors `sms.ts::sendSms` so the
 * notification abstraction can pick between them with no special-casing.
 *
 * Channel selection lives in `lib/notifications.ts` — direct callers of this
 * file are NOT expected after Phase 2 / Task 2.6 lands. The functions are
 * left exported so the dispatcher can call them with a stable signature.
 */

export interface WhatsAppSendResult {
  delivered: boolean;
  /** Provider-specific message id; undefined for the dev stub. */
  messageId?: string;
}

export async function sendWhatsapp(opts: {
  mobile: string;
  message: string;
}): Promise<WhatsAppSendResult> {
  // eslint-disable-next-line no-console
  console.log(`[whatsapp-stub] → ${opts.mobile}: ${opts.message}`);
  return { delivered: true };
}

export function isWhatsappDevMode(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Optional opt-out check. Returns `true` if we believe the user can receive
 * WhatsApp messages. For MVP we assume yes when a mobile is present; once
 * a real provider lands and we track per-user opt-outs, this is the place
 * to look those up.
 */
export async function isWhatsappReachable(mobile: string): Promise<boolean> {
  return mobile.replace(/\D+/g, "").length >= 10;
}
