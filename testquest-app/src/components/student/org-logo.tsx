"use client";

/**
 * OrgLogo — drop-in replacement for `<Logo>` that swaps to the active
 * coaching centre's branding when available. Falls back to the default
 * Testquest logo for B2C students. (Task 3.5.)
 */
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/brand/logo";
import { useStudentBranding } from "@/components/student/branding-provider";

interface OrgLogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { mark: "h-7 w-7", text: "text-sm" },
  md: { mark: "h-[34px] w-[34px]", text: "text-base" },
  lg: { mark: "h-12 w-12", text: "text-xl" },
} as const;

export function OrgLogo({ className, showWordmark = true, size = "md" }: OrgLogoProps) {
  const { branding } = useStudentBranding();

  // No org context → default Testquest logo.
  if (!branding) {
    return <Logo className={className} showWordmark={showWordmark} size={size} />;
  }

  const s = SIZES[size];
  const label = branding.displayName || branding.orgName;
  const logo = branding.logoUrl || branding.logoDarkUrl;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {logo ? (
        <span
          className={cn(
            "inline-flex items-center justify-center overflow-hidden rounded-[9px] bg-surface",
            s.mark,
          )}
        >
          <Image
            src={logo}
            alt={label}
            width={48}
            height={48}
            className="h-full w-full object-contain"
            unoptimized
          />
        </span>
      ) : (
        <LogoMark className={s.mark} />
      )}
      {showWordmark && (
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground truncate max-w-[180px] md:max-w-[260px]",
            s.text,
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
