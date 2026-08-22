"use client";

/**
 * StudentListItem — single student row in a batch's Students tab.
 *
 * UI_PLAN §4 vocabulary. Shows initials avatar + name + contact + per-student
 * avg score chip + last-activity time + 3-dot menu (remove for now; transfer
 * lands later when multi-batch tools ship).
 *
 * Task 3.3: dropdown also exposes "Send parent report" when a handler is
 * wired in. We show an inline "Sent" pill next to the row for ~3s after a
 * successful send (the parent owns the timer via the `lastSentAt` prop).
 */
import { useState } from "react";
import { MoreVertical, Loader2, Trash2, Mail, Check, ArrowRightLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface StudentRow {
  studentId: number;
  name: string;
  email?: string | null;
  mobile?: string | null;
  avgScore: number | null;
  attempts: number;
  lastAttemptAt: Date | string | null;
}

function scoreClass(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 75) return "text-[color:var(--score-strong)]";
  if (pct >= 50) return "text-[color:var(--score-on-track)]";
  return "text-[color:var(--score-needs-work)]";
}

function relativeTime(d: Date | string | null): string {
  if (!d) return "no activity yet";
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - +date;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export interface StudentListItemProps extends StudentRow {
  onRemove: (studentId: number) => Promise<void>;
  canManage: boolean;
  /** When provided, surfaces a "Send parent report" item in the dropdown.
   *  The component manages its own busy state but the parent decides whether
   *  the row's recent-send pill is visible via `recentlySent`. */
  onSendReport?: (studentId: number) => Promise<void> | void;
  /** True for ~3s after a successful send; renders the inline "Sent" pill. */
  recentlySent?: boolean;
  /** Task 4.5: when provided, surfaces a "Transfer to another batch" item in
   *  the dropdown. The parent owns the dialog and the API call. */
  onTransfer?: (studentId: number) => void;
}

export function StudentListItem({
  studentId, name, mobile, avgScore, attempts, lastAttemptAt,
  onRemove, canManage, onSendReport, recentlySent, onTransfer,
}: StudentListItemProps) {
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  async function remove() {
    if (busy) return;
    if (!confirm(`Remove ${name} from this batch?`)) return;
    setBusy(true);
    try { await onRemove(studentId); } finally { setBusy(false); }
  }

  async function sendReport() {
    if (sending || !onSendReport) return;
    setSending(true);
    try { await onSendReport(studentId); } finally { setSending(false); }
  }

  const showMenu = canManage || !!onSendReport || !!onTransfer;
  const menuBusy = busy || sending;

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-dim text-primary text-sm font-bold flex-shrink-0">
        {(name || "?").charAt(0).toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {mobile ?? "—"}
          <span className="mx-2">·</span>
          {relativeTime(lastAttemptAt)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {recentlySent && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-primary-dim text-primary px-2 py-0.5 text-[10px] font-semibold"
            role="status"
            aria-live="polite"
          >
            <Check className="h-3 w-3" />
            Sent
          </span>
        )}
        <div className="text-right">
          <p className={cn("font-mono text-sm", scoreClass(avgScore))}>
            {avgScore != null ? `${avgScore}%` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {attempts} {attempts === 1 ? "attempt" : "attempts"}
          </p>
        </div>
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Student actions"
                className="rounded-md p-1.5 hover:bg-white/5 transition-colors"
                disabled={menuBusy}
              >
                {menuBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4 text-muted-foreground" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onSendReport && (
                <DropdownMenuItem onClick={sendReport} disabled={sending}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Send parent report
                </DropdownMenuItem>
              )}
              {onTransfer && (
                <DropdownMenuItem onClick={() => onTransfer(studentId)}>
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Transfer to another batch
                </DropdownMenuItem>
              )}
              {canManage && (
                <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove from batch
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
