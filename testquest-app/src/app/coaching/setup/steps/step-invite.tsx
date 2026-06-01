"use client";

/**
 * Step 4 — Invite students.
 *
 * Three modes via tabs: Generate link | Paste roster | Skip for now.
 *  - Generate link: backend issues an InviteToken; on success we show the
 *    InviteShareCard (copy + WhatsApp + SMS).
 *  - Paste roster: textarea parser, live preview of parsed rows, on submit
 *    creates students + enrollments + STUDENT memberships.
 *  - Skip: no backend write — owner can do this later from the batch detail
 *    page.
 *
 * Mode is local UI state only; the parent commits a mode-specific submission
 * via onCommit when the wizard's Next is clicked.
 */
import { useEffect, useMemo, useState } from "react";
import { Link2, Users, SkipForward, Loader2 } from "lucide-react";
import { InviteShareCard } from "@/components/coaching/invite-share-card";
import { cn } from "@/lib/utils";

export type InviteMode = "link" | "roster" | "skip";
export interface RosterRow { name: string; mobile: string; email?: string }

export interface StepInviteProps {
  centreName: string;
  batchName?: string;
  /** Already-generated share URL if any (resume case). */
  existingShareUrl?: string | null;
  loading: boolean;
  /** Commit current mode + payload. Wizard awaits this. */
  onCommit: (commit: { mode: InviteMode; roster?: RosterRow[] }) => Promise<{ url?: string } | void>;
  registerSubmit: (fn: () => void) => void;
  onValidityChange: (valid: boolean) => void;
}

export function StepInvite({
  centreName, batchName, existingShareUrl, loading, onCommit, registerSubmit, onValidityChange,
}: StepInviteProps) {
  const [mode, setMode] = useState<InviteMode>(existingShareUrl ? "link" : "link");
  const [shareUrl, setShareUrl] = useState<string | null>(existingShareUrl ?? null);
  const [rosterText, setRosterText] = useState("");

  const parsedRoster = useMemo<RosterRow[]>(() => parseRoster(rosterText), [rosterText]);

  const valid = useMemo(() => {
    if (mode === "link") return true;            // backend issues on commit
    if (mode === "skip") return true;
    return parsedRoster.length > 0 && parsedRoster.every((r) => r.name && r.mobile.length >= 10);
  }, [mode, parsedRoster]);
  useEffect(() => onValidityChange(valid), [valid, onValidityChange]);

  registerSubmit(async () => {
    const res = await onCommit(
      mode === "roster" ? { mode, roster: parsedRoster } : { mode },
    );
    if (mode === "link" && res?.url) setShareUrl(absoluteUrl(res.url));
  });

  // For "link" mode, when the user lands on the step we proactively issue the
  // token so the share card is ready immediately rather than after they hit
  // Next. The wizard re-commits on Next to mark progress.
  useEffect(() => {
    if (mode !== "link" || shareUrl || loading) return;
    let cancelled = false;
    (async () => {
      const res = await onCommit({ mode: "link" });
      if (!cancelled && res?.url) setShareUrl(absoluteUrl(res.url));
    })();
    return () => { cancelled = true; };
    // We only want this to fire on first entry of "link" mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-widest text-primary">Step 4</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">
          Invite your <em className="text-primary">students.</em>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Share a join link, paste a roster, or skip and add students later.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Tab icon={<Link2 className="h-4 w-4" />} label="Generate link"    selected={mode === "link"}    onClick={() => setMode("link")} />
        <Tab icon={<Users className="h-4 w-4" />} label="Paste roster"    selected={mode === "roster"}  onClick={() => setMode("roster")} />
        <Tab icon={<SkipForward className="h-4 w-4" />} label="Skip"      selected={mode === "skip"}    onClick={() => setMode("skip")} />
      </div>

      {mode === "link" && (
        shareUrl ? (
          <InviteShareCard url={shareUrl} centreName={centreName} batchName={batchName} />
        ) : (
          <div className="rounded-[14px] border bg-surface p-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Generating your invite link…
          </div>
        )
      )}

      {mode === "roster" && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Paste students — one per line</label>
          <textarea
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
            disabled={loading}
            placeholder={"Priya Raman, 9876543210\nAman Sharma, 9988776655, aman@example.com\n"}
            className="w-full min-h-[160px] rounded-md border bg-surface px-3 py-2 text-sm font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            Format: <code>name, mobile</code> (optional <code>, email</code>). Up to 50 students.
          </p>
          {rosterText.trim().length > 0 && (
            <RosterPreview rows={parsedRoster} />
          )}
        </div>
      )}

      {mode === "skip" && (
        <div className="rounded-[14px] border bg-surface p-6">
          <p className="text-sm">You can add students any time from the batch settings page.</p>
        </div>
      )}
    </div>
  );
}

function Tab({ icon, label, selected, onClick }: { icon: React.ReactNode; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-[14px] border px-3 py-3 text-xs transition-all",
        selected ? "border-primary bg-primary-dim text-primary" : "border-border bg-surface text-foreground/90 hover:border-primary/40",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function RosterPreview({ rows }: { rows: RosterRow[] }) {
  const invalid = rows.filter((r) => !r.name || r.mobile.length < 10);
  return (
    <div className="rounded-[10px] border bg-background/40 px-4 py-3 max-h-[260px] overflow-y-auto">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
        Preview · {rows.length} {rows.length === 1 ? "row" : "rows"}
        {invalid.length > 0 && <span className="text-destructive"> · {invalid.length} invalid</span>}
      </p>
      <ul className="space-y-1.5">
        {rows.map((r, i) => {
          const bad = !r.name || r.mobile.length < 10;
          return (
            <li key={i} className={cn("flex items-baseline gap-3 text-sm font-mono", bad && "text-destructive")}>
              <span className="text-foreground/80 truncate flex-1">{r.name || "(no name)"}</span>
              <span className="text-muted-foreground">{r.mobile || "(no mobile)"}</span>
              {r.email && <span className="text-muted-foreground/70 truncate max-w-[140px]">{r.email}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function parseRoster(text: string): RosterRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", mobile = "", email] = line.split(",").map((p) => p.trim());
      const row: RosterRow = { name, mobile };
      if (email) row.email = email;
      return row;
    })
    .slice(0, 50);
}

function absoluteUrl(pathLike: string): string {
  if (typeof window === "undefined") return pathLike;
  if (pathLike.startsWith("http")) return pathLike;
  return `${window.location.origin}${pathLike.startsWith("/") ? "" : "/"}${pathLike}`;
}
