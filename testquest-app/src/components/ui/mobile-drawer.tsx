"use client";

/**
 * Minimal mobile slide-in drawer. Used by CoachingHeader (mobile nav) and
 * AdminAppBar (mobile sidebar). Avoids adding a new dependency — built with
 * Tailwind transforms, a backdrop, and an Escape/outside-click handler.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <MobileDrawer open={open} onClose={() => setOpen(false)} side="right">
 *     ...
 *   </MobileDrawer>
 */
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title?: React.ReactNode;
  children: React.ReactNode;
};

export function MobileDrawer({ open, onClose, side = "right", title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 transition-opacity",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        tabIndex={open ? 0 : -1}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute top-0 bottom-0 flex w-[85%] max-w-[320px] flex-col bg-surface shadow-xl transition-transform duration-200",
          side === "right" ? "right-0" : "left-0",
          open
            ? "translate-x-0"
            : side === "right"
              ? "translate-x-full"
              : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
          <div className="text-sm font-medium">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
