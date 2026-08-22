import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Test Quest logo: the purple arrow-T mark (public/brand/logo-mark.png)
 * paired with a wordmark "Test" (foreground) + "Quest" (brand purple).
 * The wordmark is rendered as text so it adapts to light/dark themes;
 * the full raster lockups live in public/brand/ for marketing use.
 */
export function Logo({ className, showWordmark = true, size = "md" }: LogoProps) {
  const sizes = {
    sm: { mark: 28, text: "text-sm" },
    md: { mark: 34, text: "text-base" },
    lg: { mark: 48, text: "text-xl" },
  };
  const s = sizes[size];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark style={{ height: s.mark, width: s.mark }} />
      {showWordmark && (
        <span className={cn("font-bold tracking-tight text-foreground", s.text)}>
          Test<span className="text-primary">Quest</span>
        </span>
      )}
    </span>
  );
}

/**
 * The purple arrow-T mark. Used standalone in sidebars, favicons, footers.
 * Sized via className (h-* and w-* utilities) or style, like the old CSS mark.
 */
export function LogoMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt="Test Quest"
      width={512}
      height={512}
      className={cn("object-contain", className)}
      style={style}
      priority
    />
  );
}
