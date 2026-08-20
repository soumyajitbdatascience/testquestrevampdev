"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";

/**
 * Renders migrated question / option HTML.
 *
 * HARD RULE: question content is never shown as raw tags — anywhere it appears,
 * in admin or the student app, it goes through here. Sanitizing happens inside
 * this component rather than at the API layer so there is exactly one choke
 * point and no way to render this content unsanitized by accident.
 *
 * Math is presentation MathML, which every current browser renders natively —
 * no MathJax or KaTeX needed. See sanitize-html.ts for the Office-OMML and
 * dead-image repairs applied to the legacy content on the way through.
 *
 * `clamp` truncates to N lines for dense table rows; the untruncated markup is
 * still in the DOM, so it stays searchable and copyable.
 */
export function RichText({
  html,
  className,
  clamp,
  inline = false,
}: {
  html: string | null | undefined;
  className?: string;
  clamp?: number;
  inline?: boolean;
}) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);

  if (!clean.trim()) {
    return <span className="text-muted-foreground italic text-xs">(empty)</span>;
  }

  const Tag = inline ? "span" : "div";

  return (
    <Tag
      className={cn("tq-rich", inline && "tq-rich-inline", clamp && "tq-rich-clamp", className)}
      style={clamp ? ({ ["--tq-clamp" as string]: String(clamp) }) : undefined}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
