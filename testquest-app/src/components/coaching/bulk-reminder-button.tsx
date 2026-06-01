/**
 * "Remind all behind on this week's tests" — dashboard CTA.
 *
 * Task 5.3.2: owner/admin-only client component embedded in the otherwise
 * server-rendered /coaching/dashboard. Two-step flow:
 *   1. Open dialog -> GET /api/coaching/reminders/bulk?scope=this-week for a
 *      preflight count.
 *   2. On confirm, POST -> show inline result banner.
 */
"use client";
import { useCallback, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Scope = "this-week" | "all-active";

type Preview = { assignmentsTargeted: number; studentsTargeted: number };
type SendResult = {
  assignmentsTargeted: number;
  studentsTargeted: number;
  sent: number;
  skipped: number;
};
type Phase = "idle" | "loading-preview" | "ready" | "sending" | "done" | "error";

export function BulkReminderButton({ scope = "this-week" }: { scope?: Scope }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const openDialog = useCallback(async () => {
    setOpen(true);
    setResult(null);
    setErrMsg(null);
    setPhase("loading-preview");
    try {
      const res = await fetch(
        `/api/coaching/reminders/bulk?scope=${encodeURIComponent(scope)}`,
        { method: "GET" },
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Could not load preview");
      }
      setPreview(json.data as Preview);
      setPhase("ready");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }, [scope]);

  const send = useCallback(async () => {
    setPhase("sending");
    setErrMsg(null);
    try {
      const res = await fetch("/api/coaching/reminders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Could not send reminders");
      }
      const r = json.data as SendResult;
      setResult(r);
      setPhase("done");
      setBanner(`Sent ${r.sent} reminders. ${r.skipped} skipped.`);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }, [scope]);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-3 py-1.5 text-xs text-foreground hover:bg-white/5 transition-colors"
      >
        <Bell className="h-3.5 w-3.5" />
        Remind behind
      </button>

      {banner && (
        <div
          role="status"
          className="mt-3 rounded-[10px] border bg-surface px-3 py-2 text-xs text-muted-foreground"
        >
          {banner}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remind students behind on this week&apos;s tests</DialogTitle>
            <DialogDescription>
              Sends a WhatsApp + SMS nudge to every enrolled student who hasn&apos;t
              started an active test from the last 7 days.
            </DialogDescription>
          </DialogHeader>

          <div className="text-sm">
            {phase === "loading-preview" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Counting...
              </div>
            )}
            {phase === "ready" && preview && (
              <p>
                This will message{" "}
                <span className="text-foreground font-medium">{preview.studentsTargeted}</span>{" "}
                students across{" "}
                <span className="text-foreground font-medium">{preview.assignmentsTargeted}</span>{" "}
                assignments. Continue?
              </p>
            )}
            {phase === "sending" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Sending...
              </div>
            )}
            {phase === "done" && result && (
              <p>
                Sent <span className="text-foreground font-medium">{result.sent}</span>{" "}
                reminders.{" "}
                <span className="text-muted-foreground">
                  {result.skipped} skipped.
                </span>
              </p>
            )}
            {phase === "error" && errMsg && (
              <p className="text-destructive">{errMsg}</p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[10px] border border-strong px-3 py-1.5 text-sm hover:bg-white/5"
            >
              {phase === "done" ? "Close" : "Cancel"}
            </button>
            {(phase === "ready" || phase === "error") &&
              !(phase === "ready" && preview?.studentsTargeted === 0) && (
                <button
                  type="button"
                  onClick={send}
                  disabled={phase !== "ready"}
                  className="rounded-[10px] bg-foreground text-background px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Send reminders
                </button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
