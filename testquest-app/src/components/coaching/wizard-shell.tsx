"use client";

/**
 * WizardShell — progress bar + step container + sticky footer.
 *
 * UI_PLAN §4 vocabulary; UI_PLAN §5.1.3 layout.
 *
 * Desktop: 5 numbered dots + step name above the content area.
 * Mobile:  "Step N of 5" text + thin progress bar.
 *
 * Sticky footer with Back / Next CTAs that the parent controls — the shell
 * doesn't drive navigation, just renders the affordances.
 */
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WizardStep {
  key: string;
  title: string;
}

export interface WizardShellProps {
  steps: WizardStep[];
  currentStep: number; // 1-indexed
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  /** Hide the back button (used on step 1). */
  hideBack?: boolean;
  /** Hide both footer buttons (used on step 5 — "Done" page renders its own CTA). */
  hideFooter?: boolean;
}

export function WizardShell({
  steps, currentStep, children, onBack, onNext,
  nextLabel = "Next", backLabel = "Back",
  nextDisabled, loading, hideBack, hideFooter,
}: WizardShellProps) {
  const pct = Math.max(0, Math.min(100, (currentStep / steps.length) * 100));

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, oklch(0.76 0.17 72 / 0.10), transparent 62%)" }}
      />

      {/* Top bar */}
      <header className="relative">
        <div className="mx-auto max-w-[1280px] flex items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/coaching/dashboard" className="flex items-center gap-3">
            <Logo />
            <span className="hidden md:inline text-xs text-muted-foreground border-l pl-3">
              Setup wizard
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Progress bar */}
      <div className="relative border-b border-t">
        <div className="mx-auto max-w-[820px] px-6 lg:px-0">
          {/* Mobile */}
          <div className="md:hidden py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Step {currentStep} of {steps.length}</span>
              <span className="text-foreground font-medium">{steps[currentStep - 1]?.title}</span>
            </div>
            <div className="h-1 bg-surface-hi rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Desktop */}
          <ol className="hidden md:flex items-center justify-between py-5">
            {steps.map((s, i) => {
              const idx = i + 1;
              const isActive = idx === currentStep;
              const isDone = idx < currentStep;
              return (
                <li key={s.key} className="flex flex-1 items-center">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                        isActive && "bg-primary text-primary-foreground shadow-gold",
                        isDone && "bg-primary/30 text-primary",
                        !isActive && !isDone && "bg-surface-hi text-muted-foreground border",
                      )}
                    >
                      {isDone ? "✓" : idx}
                    </span>
                    <span
                      className={cn(
                        "text-[13px] whitespace-nowrap",
                        isActive ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      {s.title}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 mx-3 h-[1px] bg-border" />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Step content */}
      <main className="relative flex-1 px-6 py-10 lg:py-14 pb-[120px]">
        <div className="mx-auto max-w-[600px] animate-fade-in">{children}</div>
      </main>

      {/* Sticky footer */}
      {!hideFooter && (
        <footer className="sticky bottom-0 z-10 border-t bg-background/85 backdrop-blur-xl">
          <div className="mx-auto max-w-[600px] flex items-center justify-between gap-4 px-6 py-4">
            {!hideBack ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={loading || !onBack}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              onClick={onNext}
              disabled={loading || nextDisabled}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold min-w-[140px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>{nextLabel}<ArrowRight className="h-4 w-4" /></>)}
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
