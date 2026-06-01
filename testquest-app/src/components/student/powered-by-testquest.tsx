"use client";

/**
 * "Powered by Testquest" credit footer (Task 3.5).
 *
 * Shown ONLY for org-branded students whose org isn't on the Pro plan.
 * Hidden for:
 *   - B2C students (no org context — there's no one to credit "by")
 *   - Pro orgs (the credit-removal upsell is the whole point of Pro)
 *
 * Pages opt in by importing this component once at the bottom of their
 * tree; rendering decisions are made client-side from the branding context.
 */
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { useStudentBranding } from "@/components/student/branding-provider";

export function PoweredByTestquest({ className }: { className?: string }) {
  const { branding, loading } = useStudentBranding();
  if (loading) return null;
  if (!branding) return null;
  if (branding.isPro) return null;

  return (
    <div
      className={
        className ??
        "mt-12 mb-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
      }
    >
      <span>Powered by</span>
      <Link
        href="https://testquest.in"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        <LogoMark className="h-4 w-4" />
        <span className="font-semibold">
          Test<em className="font-display italic font-normal text-primary not-italic">quest</em>
        </span>
      </Link>
    </div>
  );
}
