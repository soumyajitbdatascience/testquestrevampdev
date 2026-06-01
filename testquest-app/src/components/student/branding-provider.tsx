"use client";

/**
 * BrandingProvider — client-side context that hydrates org white-label
 * branding (Task 3.5).
 *
 * Mounted once at the root layout. On mount it fetches `/api/student/branding`
 * and (if the student is in an org with white-label enabled) exposes the
 * resolved `StudentBranding` via React context. It also injects a small
 * `<style>` block into <head> that overrides the `--primary` CSS variable on
 * `:root` so every Tailwind `bg-primary` / `text-primary` swap takes effect
 * without touching every page.
 *
 * For B2C students (no enrollment, or plan gate fails) `branding` is null
 * and nothing is swapped — the default Testquest chrome is preserved.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface StudentBranding {
  orgId: number;
  orgName: string;
  logoUrl: string;
  logoDarkUrl: string;
  primaryColor: string;
  secondaryColor: string;
  displayName: string;
  supportEmail: string;
  supportPhone: string;
  isPro: boolean;
  whiteLabelAllowed: boolean;
}

interface BrandingContextValue {
  branding: StudentBranding | null;
  /** True until the first /api/student/branding fetch resolves. */
  loading: boolean;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: null,
  loading: true,
});

export function useStudentBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<StudentBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/branding")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok && d.data) setBranding(d.data as StudentBranding);
      })
      .catch(() => {
        /* anonymous / network error → fall through with null */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const primary = branding?.primaryColor?.trim();
  const secondary = branding?.secondaryColor?.trim();

  return (
    <BrandingContext.Provider value={{ branding, loading }}>
      {primary || secondary ? (
        <style
          // Scoped to :root so it cascades to both light and dark — the org
          // owner picks one accent and we apply it across themes. We only
          // override the primary token (the Testquest gold); the rest of the
          // palette stays put.
          dangerouslySetInnerHTML={{
            __html: `:root{${primary ? `--primary:${primary};--primary-dim:color-mix(in oklch, ${primary} 12%, transparent);` : ""}${secondary ? `--accent:${secondary};` : ""}}`,
          }}
        />
      ) : null}
      {children}
    </BrandingContext.Provider>
  );
}
