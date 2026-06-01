import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Meridian logo: 34×34 gold rounded square with a bold serif "T",
 * paired with a wordmark "Test" (sans) + "quest" (italic gold serif).
 */
export function Logo({ className, showWordmark = true, size = "md" }: LogoProps) {
  const sizes = {
    sm: { mark: "h-7 w-7", text: "text-sm" },
    md: { mark: "h-[34px] w-[34px]", text: "text-base" },
    lg: { mark: "h-12 w-12", text: "text-xl" },
  };
  const s = sizes[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={s.mark} />
      {showWordmark && (
        <span className={cn("font-semibold tracking-tight text-foreground", s.text)}>
          Test
          <em className="font-display italic font-normal text-primary">quest</em>
        </span>
      )}
    </span>
  );
}

/**
 * The gold square mark. Used standalone in sidebars, favicons, footers.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[9px] bg-primary shadow-gold font-display text-primary-foreground",
        className
      )}
      style={{ fontSize: "calc(0.55 * 1em)" }}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[60%] w-[60%]"
        aria-hidden
      >
        <path d="M6 9 L26 9"  stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M16 9 L16 25" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
