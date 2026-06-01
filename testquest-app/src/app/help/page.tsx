/**
 * /help — public support & FAQ page (Task 5.5).
 *
 * Server-renders the static FAQ for SEO. A small client island
 * (./faq-search) handles the search input + accordion interactions.
 *
 * Audiences: both coaching-centre owners/teachers AND students land here.
 * The header is the lightweight marketing pattern (logo + theme toggle), not
 * StudentHeader or CoachingHeader, because the page is public and either
 * audience may arrive unauthenticated.
 *
 * Walkthrough videos: real recordings are not ready yet — see TODO_VIDEO_5.5
 * markers below. Replace the placeholder cards with <iframe> embeds once the
 * English + Hindi videos are published (YouTube unlisted is fine).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Play, Globe } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { FAQ_ENTRIES, FAQ_TOPICS } from "./faq-data";
import { FaqSearch } from "./faq-search";

export const metadata: Metadata = {
  title: "Testquest Help & FAQ",
  description:
    "Answers to common questions about Testquest for coaching centres and students — trial, batches, billing, parent reports, white-label, mobile OTP, and more.",
  alternates: { canonical: "/help" },
  openGraph: {
    title: "Testquest Help & FAQ",
    description:
      "Common questions about Testquest — for coaching centre owners, teachers, and students.",
    url: "/help",
    type: "website",
  },
};

export default function HelpPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Lightweight public header */}
      <header className="border-b">
        <div className="mx-auto max-w-[1280px] h-16 px-6 lg:px-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/for-coaching-centres"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              For coaching centres
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-[1024px] px-6 lg:px-10 pt-16 pb-8 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70 mb-3">
            Help centre
          </p>
          <h1 className="font-display text-4xl md:text-6xl tracking-tight">
            How can we help?
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Browse common questions or watch a 5-minute walkthrough.
            Still stuck? Email{" "}
            <a
              href="mailto:hello@testquest.in"
              className="text-primary hover:underline"
            >
              hello@testquest.in
            </a>
            .
          </p>
        </section>

        {/* Walkthrough videos */}
        <section
          aria-labelledby="walkthrough-heading"
          className="mx-auto max-w-[1024px] px-6 lg:px-10 py-10"
        >
          <h2
            id="walkthrough-heading"
            className="font-display text-2xl md:text-3xl tracking-tight mb-6"
          >
            Watch a 5-minute walkthrough
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <VideoCard
              language="English"
              title="Testquest in 5 minutes — English"
              caption="A quick tour of the coaching centre dashboard, batches, assignments, and parent reports."
            />
            <VideoCard
              language="हिन्दी"
              title="Testquest in 5 minutes — Hindi"
              caption="कोचिंग सेंटर डैशबोर्ड, बैच, असाइनमेंट और पैरेंट रिपोर्ट का छोटा सा परिचय।"
            />
          </div>
        </section>

        {/* FAQ + search island */}
        <section
          aria-labelledby="faq-heading"
          className="mx-auto max-w-[1024px] px-6 lg:px-10 py-12"
        >
          <h2
            id="faq-heading"
            className="font-display text-2xl md:text-3xl tracking-tight mb-6"
          >
            Frequently asked questions
          </h2>
          <FaqSearch entries={FAQ_ENTRIES} topics={FAQ_TOPICS} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-8">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Testquest. Made for Indian students.</p>
          <div className="flex items-center gap-5">
            <Link href="/for-coaching-centres" className="hover:text-foreground transition-colors">
              For coaching centres
            </Link>
            <a href="mailto:hello@testquest.in" className="hover:text-foreground transition-colors">
              hello@testquest.in
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Static placeholder for the walkthrough videos until production recordings
 * land. When ready, replace the inner gradient <div> with an <iframe> pointing
 * at YouTube/Vimeo and add `loading="lazy"` + a meaningful title.
 *
 * TODO_VIDEO_5.5: swap placeholder for real <iframe> once Hindi + English
 * recordings are uploaded. Suggested aspect ratio: 16:9. Each video should be
 * roughly 5 minutes and cover signup -> batch -> assignment -> parent report.
 */
function VideoCard({
  language,
  title,
  caption,
}: {
  language: string;
  title: string;
  caption: string;
}) {
  return (
    <article className="group rounded-2xl border bg-surface/60 overflow-hidden">
      {/* TODO_VIDEO_5.5: replace this placeholder with an <iframe> embed. */}
      <div
        role="img"
        aria-label={`${title} — placeholder, video coming soon`}
        className="relative aspect-video flex items-center justify-center bg-gradient-to-br from-primary/30 via-primary/10 to-fuchsia-500/20"
      >
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_20%,white,transparent_40%),radial-gradient(circle_at_70%_80%,white,transparent_40%)]" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur ring-1 ring-white/20 transition-transform group-hover:scale-105">
          <Play className="h-6 w-6 text-white" fill="currentColor" />
        </div>
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white backdrop-blur">
          <Globe className="h-3 w-3" />
          {language}
        </span>
        <span className="absolute bottom-3 right-3 inline-flex items-center rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white backdrop-blur">
          Coming soon
        </span>
      </div>
      <div className="p-5">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{caption}</p>
      </div>
    </article>
  );
}
