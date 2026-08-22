/**
 * The shell every Testquest email renders inside.
 *
 * Email clients are twenty years behind browsers: no flexbox, no grid, no
 * external stylesheets, and Outlook still renders through Word. So this is a
 * centred table with inline styles and nothing clever — the constraint is the
 * medium, not the taste.
 *
 * Brand tokens are duplicated as literals here rather than imported from CSS,
 * because there is no cascade to inherit from inside an inbox.
 */
import * as React from "react";

export const BRAND = {
  primary: "#6134EB",
  ink: "#140C3D",
  wash: "#F4F0FE",
  muted: "#6B6685",
  border: "#E7E2F5",
  success: "#1B8A5A",
} as const;

export interface LayoutProps {
  preview: string;
  heading: string;
  children: React.ReactNode;
  cta?: { label: string; url: string };
  /** Non-transactional mail must offer a way out. */
  unsubscribeUrl?: string;
}

export function EmailLayout({ preview, heading, children, cta, unsubscribeUrl }: LayoutProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: BRAND.wash, fontFamily: "Arial, Helvetica, sans-serif" }}>
        {/* Preheader: the grey line an inbox shows next to the subject. Hidden
            in the body itself, which is why it carries the display/opacity trio. */}
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden", opacity: 0 }}>{preview}</div>

        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: BRAND.wash, padding: "24px 12px" }}>
          <tbody>
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 520, backgroundColor: "#FFFFFF", borderRadius: 16, border: `1px solid ${BRAND.border}` }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "28px 28px 0" }}>
                        <span style={{ fontSize: 18, fontWeight: "bold", color: BRAND.ink, letterSpacing: "-0.02em" }}>
                          Test<span style={{ color: BRAND.primary }}>quest</span>
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "20px 28px 0" }}>
                        <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.3, color: BRAND.ink }}>{heading}</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "12px 28px 0", fontSize: 15, lineHeight: 1.6, color: BRAND.ink }}>
                        {children}
                      </td>
                    </tr>
                    {cta && (
                      <tr>
                        <td style={{ padding: "24px 28px 0" }}>
                          <a
                            href={cta.url}
                            style={{
                              display: "inline-block", padding: "13px 26px", backgroundColor: BRAND.primary,
                              color: "#FFFFFF", textDecoration: "none", borderRadius: 10, fontWeight: "bold", fontSize: 15,
                            }}
                          >
                            {cta.label}
                          </a>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "28px 28px 28px", fontSize: 12, lineHeight: 1.6, color: BRAND.muted }}>
                        <div style={{ borderTop: `1px solid ${BRAND.border}`, paddingTop: 16 }}>
                          Testquest — test series for Class 6–12.
                          {unsubscribeUrl && (
                            <>
                              {" "}
                              <a href={unsubscribeUrl} style={{ color: BRAND.muted }}>
                                Unsubscribe from these reminders
                              </a>
                              .
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

/** A labelled row for receipts. */
export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", fontSize: 14, color: BRAND.muted }}>{label}</td>
      <td align="right" style={{ padding: "6px 0", fontSize: 14, color: BRAND.ink, fontWeight: strong ? "bold" : "normal" }}>
        {value}
      </td>
    </tr>
  );
}
