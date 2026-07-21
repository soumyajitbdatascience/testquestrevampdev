# 5. UI & theming — where to edit the global look

> **What this file tells you:** exactly which files to open for global visual changes (colours, fonts, buttons, dark mode, logo), and quick recipes for the common ones.

## The key fact

This project uses **Tailwind CSS v4**, which means **there is no `tailwind.config.js`**. All design tokens — colours, radii, fonts, light/dark palettes — live as CSS variables inside **[src/app/globals.css](../../src/app/globals.css)** (in the `@theme` block and `:root` / `.dark` sections). If you're looking for "the theme file", that's it.

## The global-look files

| File | Controls |
|---|---|
| [src/app/globals.css](../../src/app/globals.css) | **The design system.** Brand colours, background/foreground palettes for light and dark mode, border radius, spacing tokens, global element styles. Most re-theming happens only here. |
| [src/app/layout.tsx](../../src/app/layout.tsx) | The root of every page: loads the two Google fonts — `DM Serif Display` (headings, `--font-display`) and `DM Sans` (body, `--font-sans`) — and wraps the app in `ThemeProvider` (dark/light) and the branding provider. |
| [postcss.config.mjs](../../postcss.config.mjs) | The Tailwind v4 build pipeline. Rarely touched. |
| [components.json](../../components.json) | shadcn/ui generator settings (where new UI components are placed, base style). |
| `src/components/ui/*` | The shared control library (button, card, dialog, input, select, table, tabs, …). **Editing one file here restyles that control across the whole app.** |
| `src/components/theme/` | [theme-provider.tsx](../../src/components/theme/theme-provider.tsx) (dark/light context; **light is the default**) and [theme-toggle.tsx](../../src/components/theme/theme-toggle.tsx) (the switch). |
| [src/components/brand/logo.tsx](../../src/components/brand/logo.tsx) + `public/brand/` | The logo component (image mark + themed text wordmark) and the brand image assets: `logo.png` (full, with tagline), `logo-lockup.png` (no tagline), `logo-mark.png` (square icon — also the favicon source), `logo-email.png` (for emails). |
| `src/components/decor/*` | The decorative background animations (constellation, rotating yantra, drifting formulas, pulse rings). Their design language is documented in [ANIMATIONS.md](../../ANIMATIONS.md). |

## White-labelling (per-coaching-centre branding)

Coaching centres override the default look for their students. That system is separate from the global theme:

| File | Role |
|---|---|
| [src/components/student/branding-provider.tsx](../../src/components/student/branding-provider.tsx) | Fetches the student's centre branding and applies its colours/logo over the student UI |
| [src/lib/org-branding.ts](../../src/lib/org-branding.ts) | Server-side lookup of a centre's branding |
| [src/lib/branding-for-email.ts](../../src/lib/branding-for-email.ts) | The same branding applied inside emails |
| [src/lib/services/branding.service.ts](../../src/lib/services/branding.service.ts) | Saving branding from the coaching settings screen |

So: a **global** restyle = `globals.css`; a change to **how centres customise** their look = the branding files.

## Recipes

| I want to… | Edit |
|---|---|
| Change brand colours / the whole palette | `globals.css` (`@theme` + `:root` / `.dark` variables) |
| Change fonts | `layout.tsx` (font imports) + the font variables in `globals.css` |
| Restyle every button / card / input | The matching file in `src/components/ui/` |
| Change the logo | Replace the images in `public/brand/` and regenerate `src/app/favicon.ico` + `src/app/icon.png` from the new mark; component: `src/components/brand/logo.tsx` |
| Adjust dark-mode colours only | The `.dark` block in `globals.css` |
| Change the default theme (currently light) | `theme-provider.tsx` + the pre-hydration script in `src/app/layout.tsx` |
| Change the student page header/nav | `src/components/student/student-header.tsx` |
| Change the admin shell | `src/components/admin/admin-sidebar.tsx` + `src/app/admin/(authenticated)/layout.tsx` |
| Change the coaching portal shell | `src/components/coaching/coaching-header.tsx` / `coaching-mobile-nav.tsx` |
| Tone down / remove background animations | The component in `src/components/decor/` and where the landing page ([src/app/page.tsx](../../src/app/page.tsx)) uses it |

## Tips

- After a token change in `globals.css`, check **both** light and dark mode — every colour has two values.
- Page-level styling is Tailwind utility classes inside each `page.tsx`; only cross-app changes belong in the files above.
- New shadcn components are added with `npx shadcn@latest add <name>` and land in `src/components/ui/`.
