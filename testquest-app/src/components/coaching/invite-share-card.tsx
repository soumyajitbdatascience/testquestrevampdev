"use client";

/**
 * InviteShareCard — generated invite URL with copy + share affordances.
 *
 * UI_PLAN §4 vocabulary. Used by /coaching/setup step 4 and (later) by the
 * batch detail page (Task 1.7) for re-issuing links.
 *
 * Share strategy: navigator.share if available (mobile PWAs / iOS / Android);
 * else fall back to explicit WhatsApp + SMS deep links. No phone number is
 * embedded — these open the user's contact picker.
 */
import { useState } from "react";
import { Copy, Check, MessageCircle, Phone } from "lucide-react";

export interface InviteShareCardProps {
  /** Absolute URL the owner will share with their students. */
  url: string;
  /** Centre name used in the prefilled share text. */
  centreName: string;
  /** Optional batch name used in the prefilled share text. */
  batchName?: string;
}

export function InviteShareCard({ url, centreName, batchName }: InviteShareCardProps) {
  const [copied, setCopied] = useState(false);

  const messageBody = batchName
    ? `Join ${centreName} — ${batchName} on Testquest: ${url}`
    : `Join ${centreName} on Testquest: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Silently ignore; user can still select-all-and-copy from the input.
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share!({
          title: `Join ${centreName} on Testquest`,
          text: messageBody,
          url,
        });
      } catch {/* user dismissed */}
    }
  }

  return (
    <div className="rounded-[14px] border bg-surface p-5">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Invite link</p>
      <div className="mt-3 flex items-stretch gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-[10px] border bg-background/40 px-3 py-2.5 text-sm font-mono text-foreground/90"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold shadow-gold transition-transform hover:-translate-y-0.5"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={nativeShare}
          className="hidden md:inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-3.5 py-2 text-xs text-foreground hover:bg-white/5 transition-colors"
        >
          Share…
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(messageBody)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-3.5 py-2 text-xs text-foreground hover:bg-white/5 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </a>
        <a
          href={`sms:?&body=${encodeURIComponent(messageBody)}`}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-3.5 py-2 text-xs text-foreground hover:bg-white/5 transition-colors"
        >
          <Phone className="h-3.5 w-3.5" />
          SMS
        </a>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Anyone with this link can join your centre — keep it private. Expires in 30 days.
      </p>
    </div>
  );
}
