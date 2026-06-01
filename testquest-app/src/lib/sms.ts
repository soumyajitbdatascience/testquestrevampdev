/**
 * SMS provider shim.
 *
 * No real provider is wired up yet. In dev we just log the payload. In
 * production we'll swap in MSG91 / Gupshup / Twilio via the same interface.
 *
 * `sendOtpSms` always succeeds in dev (returns `{ delivered: true }`) and
 * also returns the OTP itself so the caller can echo it back to the API
 * response when `NODE_ENV !== "production"`. This makes the join flow
 * testable end-to-end without a real SMS provider.
 *
 * SMS_V2_TODO: wire a real provider before any external launch.
 */

export interface SmsSendResult {
  delivered: boolean;
  /** Provider-specific message id; undefined for the dev stub. */
  messageId?: string;
}

export async function sendOtpSms(opts: {
  mobile: string;
  code: string;
  /** Centre name to mention in the message. */
  centreName?: string;
}): Promise<SmsSendResult> {
  const msg = opts.centreName
    ? `${opts.code} is your Testquest verification code for ${opts.centreName}. Valid for 5 minutes.`
    : `${opts.code} is your Testquest verification code. Valid for 5 minutes.`;

  // eslint-disable-next-line no-console
  console.log(`[sms-stub] → ${opts.mobile}: ${msg}`);

  return { delivered: true };
}

/** Send an arbitrary SMS — used by assignment notifications. */
export async function sendSms(opts: { mobile: string; message: string }): Promise<SmsSendResult> {
  // eslint-disable-next-line no-console
  console.log(`[sms-stub] → ${opts.mobile}: ${opts.message}`);
  return { delivered: true };
}

/** True when the API may include the OTP in its response (dev only). */
export function isSmsDevMode(): boolean {
  return process.env.NODE_ENV !== "production";
}
