"use client";

/**
 * /for-coaching-centres — B2B landing page.
 *
 * Spec: IMPLEMENTATION_PLAN.md Task 1.1, UI_PLAN.md §5.1.1.
 * Reference screen: src/app/page.tsx (consumer landing) — copy the visual
 * vocabulary verbatim (sticky header, gradient-glow backgrounds, useReveal
 * sections, font-display italics, decor components).
 *
 * Per UI_PLAN §7.4, marketing surfaces like this one are allowed full brand
 * expressiveness. Operational screens (dashboard, batch list) stay closer to
 * convention.
 *
 * NOTE on pricing numbers: placeholder per IMPLEMENTATION_PLAN.md §4 Task 0.2
 * ("Use placeholder pricing"). Real numbers land when the SubscriptionPlan
 * seed runs and product picks finals — search this file for `PRICING_TODO`.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Sparkles,
  BookOpen,
  FileText,
  Smartphone,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useReveal } from "@/hooks/use-reveal";
import { useCountUp } from "@/components/decor/use-count-up";
import { QuestConstellation } from "@/components/decor/quest-constellation";
import { AchievementPulseRings } from "@/components/decor/achievement-pulse-rings";
import { DriftingFormulas } from "@/components/decor/drifting-formulas";
import { RotatingYantra } from "@/components/decor/rotating-yantra";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { PlanComparisonCard, type PlanTier } from "@/components/coaching/plan-comparison-card";

// PRICING_TODO: replace with finalised numbers once SubscriptionPlan seed lands.
const PLANS: PlanTier[] = [
  {
    name: "Starter",
    tagline: "For solo teachers trying it out.",
    priceLine: "Free",
    subPrice: "14-day trial · up to 50 students",
    features: [
      "Full Testquest question bank",
      "1 batch, 1 owner",
      "Email + SMS student invites",
      "Standard score reports",
    ],
    ctaLabel: "Start trial",
    ctaHref: "/coaching/signup",
  },
  {
    name: "Growth",
    tagline: "For centres with 50–300 students.",
    priceLine: "₹149",
    subPrice: "per student / month · billed annually",
    features: [
      "Unlimited batches",
      "Up to 3 co-teachers",
      "Custom test builder",
      "WhatsApp student invites",
      "Branded weekly score emails",
    ],
    ctaLabel: "Start trial",
    ctaHref: "/coaching/signup",
  },
  {
    name: "Pro",
    tagline: "For established centres.",
    priceLine: "₹299",
    subPrice: "per student / month · billed annually",
    features: [
      "Everything in Growth",
      "Unlimited co-teachers",
      "White-label (logo, colors, domain)",
      "Branded parent PDF reports",
      "Org-scoped question bank uploads",
      "Priority support",
    ],
    ctaLabel: "Start trial",
    ctaHref: "/coaching/signup",
    highlighted: true,
  },
  {
    name: "Enterprise",
    tagline: "For multi-branch institutes.",
    priceLine: "Custom",
    subPrice: "Bespoke pricing & onboarding",
    features: [
      "Everything in Pro",
      "Multi-branch hierarchy",
      "SSO + data residency options",
      "Dedicated account manager",
      "Custom integrations",
    ],
    ctaLabel: "Book a demo",
    ctaHref: "/coaching/demo",
  },
];

const VALUE_PROPS = [
  {
    icon: BookOpen,
    title: "28,000+ question bank, day one.",
    body: "Your students get the full Testquest library across CBSE, ICSE, and State boards — Class 6 to 12. No content team required.",
  },
  {
    icon: FileText,
    title: "Branded parent reports, weekly.",
    body: "Auto-generated weekly PDFs with your logo, your colors, and your name on top. Parents see your brand, not ours.",
  },
  {
    icon: Smartphone,
    title: "Built for budget Android.",
    body: "Mobile-first across every screen. Tested on sub-₹15k phones. Your students don't need a flagship to take a test.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Is my centre's student data private?",
    a: "Yes. Each centre's students, batches, and assignment data are isolated. Other centres can never see your roster or your custom questions. We follow standard SaaS data isolation — your data is queryable only with your org context.",
  },
  {
    q: "Can I use my own branding?",
    a: "On the Pro tier and above, yes. Upload your logo, set primary/secondary brand colors, and even use your own subdomain (e.g. tests.youracademy.in). Parent reports, student emails, and the student web app all switch to your branding.",
  },
  {
    q: "Do my students need to download anything?",
    a: "No. They take tests in any modern browser — no app install required. The existing Testquest mobile app also works for them with the same login if they prefer.",
  },
  {
    q: "What's the minimum contract?",
    a: "None on Starter and Growth — pay month-to-month or cancel anytime. Pro and Enterprise are annual by default; talk to us if you need monthly.",
  },
  {
    q: "How quickly can I onboard?",
    a: "From signup to first assignment sent: about 10 minutes. Our 5-step setup wizard walks you through branding, your first batch, and student invites in one sitting.",
  },
  {
    q: "What if I already have my own question bank?",
    a: "On Growth and above, upload your own questions via Excel or paste-and-edit. Your questions stay private to your org — Testquest's bank stays available alongside.",
  },
];

export default function ForCoachingCentresPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background glows + grid — same recipe as the consumer landing */}
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, oklch(0.76 0.17 72 / 0.11), transparent 62%)" }}
      />
      <div
        className="absolute bottom-[-100px] left-[-60px] w-[520px] h-[520px] pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.66 0.14 195 / 0.08), transparent 62%)" }}
      />
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[110vh] pointer-events-none">
        <QuestConstellation />
      </div>

      {/* Nav */}
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-50 h-[68px] transition-all duration-[400ms]",
          scrolled && "backdrop-blur-xl border-b",
        )}
        style={{
          background: scrolled ? "oklch(0.11 0.015 265 / 0.85)" : "transparent",
          borderBottomColor: scrolled ? "var(--border)" : "transparent",
        }}
      >
        <div className="mx-auto max-w-[1280px] h-full flex items-center justify-between px-6 lg:px-[72px]">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
            <span className="hidden md:inline text-xs text-muted-foreground border-l pl-3">For coaching centres</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: "Why Testquest", href: "#why" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ].map((l) => (
              <a key={l.label} href={l.href} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/coaching/login"
              className="hidden sm:inline-flex px-4 py-2 text-sm text-foreground/90 hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/coaching/signup"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-4 sm:px-5 py-2.5 text-sm font-bold animate-pulse-gold transition-transform hover:-translate-y-0.5"
            >
              Start trial
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-[160px] pb-[80px] lg:pt-[200px] lg:pb-[120px] px-6 lg:px-[72px]">
        <div className="mx-auto max-w-[1280px] grid lg:grid-cols-[1fr_520px] gap-12 lg:gap-20 items-center">
          <div className="max-w-[640px]">
            <div
              className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3.5 py-[5px] text-xs text-muted-foreground mb-7 animate-slide-up"
              style={{ animationDelay: "0ms" }}
            >
              <span className="text-primary">✦</span>
              For coaching centres & schools
            </div>

            <h1 className="font-display text-[44px] sm:text-[60px] lg:text-[76px] leading-[1.05] tracking-tight">
              <span className="block animate-slide-up" style={{ animationDelay: "100ms" }}>Run your centre,</span>
              <span className="block animate-slide-up" style={{ animationDelay: "230ms" }}>not the content team.</span>
              <span className="block italic text-primary animate-slide-up" style={{ animationDelay: "360ms" }}>
                We bring the tests.
              </span>
            </h1>

            <p
              className="mt-7 max-w-[520px] text-[17px] leading-[1.7] text-muted-foreground animate-fade-in"
              style={{ animationDelay: "500ms" }}
            >
              Give your students 28,000+ chapter-wise tests, send branded weekly parent reports,
              and track every batch from one dashboard. Your brand, our engine.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 animate-slide-up" style={{ animationDelay: "640ms" }}>
              <Link
                href="/coaching/signup"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-6 py-3.5 text-sm font-bold shadow-gold transition-transform hover:-translate-y-0.5"
              >
                Start 14-day free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/coaching/demo"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-6 py-3.5 text-sm text-foreground hover:bg-white/5 transition-colors"
              >
                Book a demo
              </Link>
            </div>

            <p
              className="mt-6 text-xs text-muted-foreground animate-fade-in"
              style={{ animationDelay: "820ms" }}
            >
              No credit card required. Set up your first batch in 10 minutes.
            </p>
          </div>

          {/* Right column — JSX device-frame mock of the coaching dashboard */}
          <div className="animate-slide-in-r" style={{ animationDelay: "280ms" }}>
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* Value props */}
      <SectionValueProps />

      {/* Pricing */}
      <SectionPricing />

      {/* Testimonials */}
      <SectionTestimonials />

      {/* FAQ */}
      <SectionFaq />

      {/* Final CTA */}
      <SectionFinalCta />

      {/* Footer */}
      <footer className="relative border-t mt-12">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-[72px] py-10 grid gap-8 md:grid-cols-4">
          <div>
            <Link href="/" className="inline-block mb-3">
              <Logo size="sm" />
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The B2B layer of Testquest — for coaching centres, schools, and tutoring institutes.
            </p>
          </div>
          {[
            { title: "Product",   items: [["Pricing", "#pricing"], ["FAQ", "#faq"], ["Help centre", "/help"], ["Book a demo", "/coaching/demo"]] },
            { title: "For students", items: [["Browse tests", "/tests"], ["Sign up", "/signup"], ["Sign in", "/login"]] },
            { title: "Legal",     items: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Refunds", "/refund"]] },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70 mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.items.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-[72px] py-6 border-t flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Testquest. Made for Indian students.</p>
          <p>India</p>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------------------------------------- */
/*  Dashboard mock — stylised JSX preview of /coaching/dashboard */
/* ----------------------------------------------------------- */
function DashboardMock() {
  const studentsCount = useCountUp({ target: 142 });
  return (
    <div
      ref={studentsCount.ref as React.RefObject<HTMLDivElement>}
      className="relative rounded-[22px] border bg-surface overflow-hidden shadow-soft animate-float-0"
    >
      {/* Fake browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b bg-surface-hi/60">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--score-on-track)]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--score-strong)]/70" />
        <span className="ml-3 text-[10px] font-mono text-muted-foreground tracking-wide">
          testquest.in/coaching/dashboard
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Trial banner */}
        <div className="rounded-[10px] border border-primary/40 bg-primary-dim px-3 py-2 text-[11px] flex items-center justify-between gap-2">
          <span className="text-primary font-medium">Trial · 11 days left</span>
          <span className="text-primary/80 underline underline-offset-2">Upgrade</span>
        </div>

        {/* Greeting */}
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Good morning</p>
          <p className="mt-1 font-display text-xl">Sunrise Coaching Centre</p>
        </div>

        {/* Stat tiles 2×2 */}
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Students" value={studentsCount.value.toLocaleString("en-IN")} />
          <StatTile label="Active batches" value="6" />
          <StatTile label="Tests this week" value="14" />
          <StatTile label="Avg score" value="72%" accent />
        </div>

        {/* Batch row */}
        <div className="rounded-[10px] border bg-surface-hi/40 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Class 10 CBSE Morning 2026</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">42 students · 4 subjects</p>
            </div>
            <span className="text-[10px] text-primary inline-flex items-center gap-0.5">
              Assign
              <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        {/* Activity rows */}
        <div className="space-y-1.5">
          <ActivityRow text="Priya R. completed Quadratic Equations" score="92%" />
          <ActivityRow text="Aman S. completed Cell Structure" score="78%" />
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[10px] border bg-background/40 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-display text-lg", accent && "text-primary italic")}>{value}</p>
    </div>
  );
}

function ActivityRow({ text, score }: { text: string; score: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-1">
      <span className="text-foreground/80 truncate pr-2">{text}</span>
      <span className="font-mono text-primary flex-shrink-0">{score}</span>
    </div>
  );
}

/* ----------------------------------------------------------- */
/*  Value props                                                 */
/* ----------------------------------------------------------- */
function SectionValueProps() {
  const refs = [useReveal(), useReveal(), useReveal()];
  return (
    <section id="why" className="relative py-24 lg:py-[96px] px-6 lg:px-[72px]">
      <div className="mx-auto max-w-[1280px]">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[11px] font-medium uppercase tracking-widest text-primary">Why Testquest</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-balance">
            Three reasons centres switch <em className="text-primary">in week one.</em>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {VALUE_PROPS.map((v, i) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                ref={refs[i] as React.RefObject<HTMLDivElement>}
                className="reveal rounded-[22px] border bg-surface px-7 py-8 transition-all hover:-translate-y-[3px] hover:shadow-soft"
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-dim text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-2xl leading-tight">{v.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{v.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- */
/*  Pricing                                                     */
/* ----------------------------------------------------------- */
function SectionPricing() {
  return (
    <section id="pricing" className="relative py-24 lg:py-[96px] px-6 lg:px-[72px] overflow-hidden">
      <DriftingFormulas opacity={0.07} />
      <div className="relative mx-auto max-w-[1280px]">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[11px] font-medium uppercase tracking-widest text-primary">Pricing</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-balance">
            Start free. <em className="text-primary">Scale when you're ready.</em>
          </h2>
          <p className="mt-5 text-sm text-muted-foreground max-w-lg mx-auto">
            All plans include the full 28,000+ question bank. Pay per active student, billed annually.
          </p>
        </div>

        {/* Card row — horizontal scroll on mobile, 4-col grid on desktop */}
        <div className="
          -mx-6 lg:mx-0 px-6 lg:px-0
          overflow-x-auto lg:overflow-visible
          snap-x snap-mandatory lg:snap-none
          [-ms-overflow-style:none] [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        ">
          <div className="flex lg:grid lg:grid-cols-4 gap-5 min-w-max lg:min-w-0 pt-3 pb-1">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="snap-start flex-shrink-0 w-[280px] lg:w-auto flex"
              >
                <div className="w-full">
                  <PlanComparisonCard plan={plan} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Per-student pricing means you're never paying for inactive seats. Cancel any time.
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- */
/*  Testimonials                                                */
/* ----------------------------------------------------------- */
function SectionTestimonials() {
  const refs = [useReveal(), useReveal()];
  const quotes = [
    {
      quote:
        "We replaced three subscription tools with Testquest. Parents finally trust the report card because it's branded with our centre's name, not someone else's.",
      name: "Founder, Sunrise Tutorials",
      city: "Pune",
    },
    {
      quote:
        "The wizard had me from signup to first test assigned in under 15 minutes. My students were practising on day one.",
      name: "Owner, BrightPath Academy",
      city: "Bengaluru",
    },
  ];
  return (
    <section className="relative py-24 lg:py-[96px] px-6 lg:px-[72px]">
      <div className="mx-auto max-w-[1280px]">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[11px] font-medium uppercase tracking-widest text-primary">From our early centres</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-balance">
            What owners <em className="text-primary">are saying.</em>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
          {quotes.map((t, i) => (
            <div
              key={t.name}
              ref={refs[i] as React.RefObject<HTMLDivElement>}
              className="reveal relative rounded-[22px] border bg-surface px-7 py-8"
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <Sparkles className="h-5 w-5 text-primary mb-4" />
              <p className="font-display text-lg italic leading-relaxed text-foreground/95">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-5 pt-5 border-t flex items-center justify-between">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.city}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Real quotes published after closed beta · these are placeholders during pre-launch
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- */
/*  FAQ                                                         */
/* ----------------------------------------------------------- */
function SectionFaq() {
  return (
    <section id="faq" className="relative py-24 lg:py-[96px] px-6 lg:px-[72px]">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <p className="text-[11px] font-medium uppercase tracking-widest text-primary">FAQ</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-balance">
            Questions, <em className="text-primary">answered.</em>
          </h2>
        </div>

        <Accordion
          type="single"
          collapsible
          className="rounded-[22px] border bg-surface overflow-hidden divide-y"
        >
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={item.q} value={`item-${i}`} className="border-b-0 px-6">
              <AccordionTrigger className="text-base font-medium hover:no-underline py-5">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- */
/*  Final CTA                                                   */
/* ----------------------------------------------------------- */
function SectionFinalCta() {
  return (
    <section className="relative py-24 lg:py-[96px] px-6 lg:px-[72px]">
      <div className="mx-auto max-w-[1280px]">
        <div className="relative rounded-[28px] border bg-surface overflow-hidden px-6 py-16 lg:py-24 text-center">
          <div className="absolute top-[-100px] right-[-60px] w-[400px] h-[400px] pointer-events-none bg-glow-gold animate-glow" />
          <div className="absolute bottom-[-80px] left-[-40px] w-[320px] h-[320px] pointer-events-none bg-glow-teal" />
          <div className="absolute top-[-60px] right-[-60px] hidden md:block pointer-events-none">
            <RotatingYantra size={280} />
          </div>
          <div className="absolute inset-0 pointer-events-none">
            <AchievementPulseRings
              anchor="center"
              color="oklch(0.76 0.17 72 / 0.5)"
              ringCount={2}
              duration={3.4}
              size={70}
            />
          </div>

          <div className="relative">
            <LogoMark className="h-12 w-12 mx-auto mb-6" />
            <h2 className="font-display text-4xl md:text-6xl text-balance">
              Run a smarter centre <em className="text-primary">starting today.</em>
            </h2>
            <p className="mt-5 text-base text-muted-foreground max-w-md mx-auto">
              14-day free trial. No card. Cancel any time.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link
                href="/coaching/signup"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-7 py-4 text-sm font-bold shadow-gold animate-pulse-gold"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/coaching/demo"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-7 py-4 text-sm text-foreground hover:bg-white/5 transition-colors"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
