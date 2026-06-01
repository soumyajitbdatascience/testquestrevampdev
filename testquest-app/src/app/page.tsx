"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ArrowRight, Star, ChevronRight, Check, Sparkles } from "lucide-react";
import { useReveal } from "@/hooks/use-reveal";
import { useCountUp } from "@/components/decor/use-count-up";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { QuestConstellation } from "@/components/decor/quest-constellation";
import { AchievementPulseRings } from "@/components/decor/achievement-pulse-rings";
import { DriftingFormulas } from "@/components/decor/drifting-formulas";
import { RotatingYantra } from "@/components/decor/rotating-yantra";

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "Social Science", "Science", "Hindi",
  "Sanskrit", "Computer Science", "Economics", "Accountancy",
];

const SUBCOLOR: Record<string, string> = {
  Mathematics: "oklch(0.76 0.17 72)",
  Physics:     "oklch(0.66 0.14 195)",
  Chemistry:   "oklch(0.68 0.15 355)",
  Biology:     "oklch(0.76 0.17 72)",
  Science:     "oklch(0.66 0.14 195)",
  English:     "oklch(0.75 0.15 200)",
  "Social Science": "oklch(0.68 0.15 355)",
  Hindi:       "oklch(0.78 0.17 65)",
  Sanskrit:    "oklch(0.66 0.14 195)",
  "Computer Science": "oklch(0.65 0.17 145)",
  Economics:   "oklch(0.70 0.15 130)",
  Accountancy: "oklch(0.78 0.17 65)",
};

const TESTS = [
  { cls: "Class 10", sub: "Mathematics", name: "Quadratic Equations", q: 20, time: 30, marks: 40, free: true,  score: 82 },
  { cls: "Class 12", sub: "Physics",     name: "Laws of Motion",      q: 25, time: 45, marks: 50, free: false, price: 99, score: null },
  { cls: "Class 9",  sub: "Chemistry",   name: "Atoms & Molecules",   q: 15, time: 20, marks: 30, free: true,  score: null },
  { cls: "Class 11", sub: "Biology",     name: "Cell Structure",      q: 22, time: 35, marks: 44, free: false, price: 79, score: 71 },
  { cls: "Class 10", sub: "English",     name: "Reading Comprehension", q: 18, time: 25, marks: 36, free: true,  score: 90 },
  { cls: "Class 12", sub: "Chemistry",   name: "Organic Chemistry",   q: 30, time: 60, marks: 60, free: false, price: 149, score: null },
  { cls: "Class 11", sub: "Mathematics", name: "Permutations & Combinations", q: 25, time: 40, marks: 50, free: false, price: 99, score: null },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, oklch(0.76 0.17 72 / 0.11), transparent 62%)" }} />
      <div className="absolute bottom-[-100px] left-[-60px] w-[520px] h-[520px] pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.66 0.14 195 / 0.08), transparent 62%)" }} />
      <div className="absolute inset-0 bg-grid pointer-events-none" />

      {/* Decorative quest constellation — sits above grid, below content */}
      <div className="absolute inset-x-0 top-0 h-[110vh] pointer-events-none">
        <QuestConstellation />
      </div>

      {/* Nav */}
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-50 h-[68px] transition-all duration-[400ms]",
          scrolled && "backdrop-blur-xl border-b"
        )}
        style={{
          background: scrolled ? "oklch(0.11 0.015 265 / 0.85)" : "transparent",
          borderBottomColor: scrolled ? "var(--border)" : "transparent",
        }}
      >
        <div className="mx-auto max-w-[1280px] h-full flex items-center justify-between px-6 lg:px-[72px]">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: "How it works", href: "#how-it-works" },
              { label: "Subjects", href: "#subjects" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ].map((l) => (
              <a key={l.label} href={l.href} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </a>
            ))}
            <Link
              href="/for-coaching-centres"
              className="inline-flex items-center gap-1 text-[13.5px] text-muted-foreground hover:text-foreground transition-colors"
            >
              For centres
              <span className="text-primary" aria-hidden>↗</span>
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:inline-flex px-4 py-2 text-sm text-foreground/90 hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-4 sm:px-5 py-2.5 text-sm font-bold animate-pulse-gold transition-transform hover:-translate-y-0.5"
            >
              Start free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-[160px] pb-[80px] lg:pt-[200px] lg:pb-[120px] px-6 lg:px-[72px]">
        <div className="mx-auto max-w-[1280px] grid lg:grid-cols-[1fr_460px] gap-12 lg:gap-20 items-center">
          {/* Left column */}
          <div className="max-w-[640px]">
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3.5 py-[5px] text-xs text-muted-foreground mb-7 animate-slide-up"
              style={{ animationDelay: "0ms" }}>
              <span className="text-primary">✦</span>
              Built for CBSE, ICSE &amp; State Board students
            </div>

            <h1 className="font-display text-[44px] sm:text-[60px] lg:text-[80px] leading-[1.05] tracking-tight">
              <span className="block animate-slide-up" style={{ animationDelay: "100ms" }}>The smart way to</span>
              <span className="block animate-slide-up" style={{ animationDelay: "230ms" }}>master your</span>
              <span className="block italic text-primary animate-slide-up" style={{ animationDelay: "360ms" }}>exams.</span>
            </h1>

            <p className="mt-7 max-w-[520px] text-[17px] leading-[1.7] text-muted-foreground animate-fade-in"
              style={{ animationDelay: "500ms" }}>
              Thousands of chapter-wise tests with detailed solutions. Track progress, identify weak spots, and walk into your exams with confidence.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 animate-slide-up" style={{ animationDelay: "640ms" }}>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-6 py-3.5 text-sm font-bold shadow-gold transition-transform hover:-translate-y-0.5"
              >
                Start free — no card needed
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tests"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-6 py-3.5 text-sm text-foreground hover:bg-white/5 transition-colors"
              >
                Explore tests
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-3 animate-fade-in" style={{ animationDelay: "820ms" }}>
              <div className="flex -space-x-2">
                {["A", "P", "S", "R"].map((letter, i) => (
                  <div
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-surface-hi text-foreground/90 font-medium text-xs"
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Trusted by students across India</p>
              </div>
            </div>
          </div>

          {/* Right column — floating stat cards */}
          <div className="flex flex-col gap-3.5">
            {[
              { label: "Practice questions", value: "28,000+", indent: false },
              { label: "Curated tests",       value: "400+",    indent: true },
              { label: "Class range",         value: "6 – 12",  indent: false },
              { label: "Boards covered",      value: "3",       indent: true, sub: "CBSE · ICSE · State" },
            ].map((card, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border bg-surface px-5 py-5 animate-slide-in-r",
                  i === 0 && "animate-float-0",
                  i === 1 && "animate-float-1 ml-0 lg:ml-8",
                  i === 2 && "animate-float-2",
                  i === 3 && "animate-float-3 ml-0 lg:ml-8",
                )}
                style={{ animationDelay: `${280 + i * 150}ms` }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{card.label}</p>
                <p className="mt-1 font-display text-3xl text-foreground">{card.value}</p>
                {card.sub && <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subject ticker */}
      <div className="relative border-y bg-surface overflow-hidden py-[14px] group">
        <div className="flex gap-0 whitespace-nowrap animate-ticker group-hover:[animation-play-state:paused]">
          {[...SUBJECTS, ...SUBJECTS].map((s, i) => (
            <span key={i} className="inline-flex items-center px-7 text-sm text-muted-foreground">
              {s}
              <span className="ml-7 text-primary">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <SectionHowItWorks />

      {/* Quiz demo */}
      <SectionQuizDemo />

      {/* Test carousel */}
      <SectionTestCarousel />

      {/* Stats counter */}
      <SectionStatsCounter />

      {/* Pricing teaser */}
      <SectionPricing />

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
              Smart test prep for Class 6–12 students across India.
            </p>
          </div>
          {[
            { title: "Product",  items: [["Browse tests", "/tests"], ["Pricing", "#pricing"], ["How it works", "#how-it-works"], ["For coaching centres", "/for-coaching-centres"]] },
            { title: "Company",  items: [["About", "/about"], ["Contact", "/contact"], ["Careers", "/careers"]] },
            { title: "Legal",    items: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Refunds", "/refund"]] },
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

/* ------------------------------------------------------------ */
/*  How it works                                                 */
/* ------------------------------------------------------------ */
function SectionHowItWorks() {
  const refs = [useReveal(), useReveal(), useReveal()];
  const steps = [
    { n: "01", title: "Pick your class", desc: "Tell us your class and board. We'll map tests to your exact syllabus." },
    { n: "02", title: "Practice with intent", desc: "Timed tests or unlimited practice. Get instant feedback and explanations." },
    { n: "03", title: "Watch yourself improve", desc: "Track scores, spot weak chapters, build the confidence to ace exams." },
  ];

  return (
    <section id="how-it-works" className="relative py-24 lg:py-[96px] px-6 lg:px-[72px]">
      <div className="mx-auto max-w-[1280px]">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[11px] font-medium uppercase tracking-widest text-primary">How it works</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-balance">
            Three steps to <em className="text-primary">exam-ready.</em>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {steps.map((s, i) => (
            <div
              key={s.n}
              ref={refs[i] as React.RefObject<HTMLDivElement>}
              className="reveal rounded-[22px] border bg-surface px-7 py-8 transition-all hover:-translate-y-[3px] hover:shadow-soft"
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
              <h3 className="mt-4 font-display text-2xl">{s.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ */
/*  Quiz Demo                                                    */
/* ------------------------------------------------------------ */
function SectionQuizDemo() {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  const QUESTION = {
    subject: "Mathematics · Class 10",
    text: "If two positive integers a and b can be expressed as a = x³y² and b = xy³, where x and y are primes, then the HCF(a, b) is:",
    options: ["xy", "xy²", "x²y²", "x³y³"],
    correctIndex: 1,
    explanation: "HCF takes the lowest power of each common prime factor. So HCF = x¹ · y² = xy².",
  };

  useEffect(() => {
    if (revealed) return;
    if (timeLeft <= 0) {
      setRevealed(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, revealed]);

  function pick(i: number) {
    if (revealed) return;
    setSelected(i);
    setRevealed(true);
  }

  function reset() {
    setSelected(null);
    setRevealed(false);
    setTimeLeft(30);
  }

  const circumference = 2 * Math.PI * 22;
  const dashOffset = circumference * (1 - timeLeft / 30);
  const ringColor = revealed ? "var(--muted-foreground)" : timeLeft <= 10 ? "var(--destructive)" : "var(--primary)";

  return (
    <section className="relative py-24 lg:py-[96px] px-6 lg:px-[72px]">
      <div className="mx-auto max-w-[1280px] grid gap-10 lg:grid-cols-2 items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-primary">Try a question</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-balance">
            See how <em className="text-primary">we teach.</em>
          </h2>
          <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-md">
            Every paid question comes with a clear, step-by-step explanation. Understand the why — not just the answer.
          </p>

          <ul className="mt-8 space-y-3 max-w-md">
            {[
              "Instant score after each question",
              "Detailed written explanations",
              "Subject-wise analytics dashboard",
              "Retake until you score 100%",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Quiz card */}
        <div className="rounded-3xl border bg-surface overflow-hidden shadow-soft">
          <div className="flex items-center justify-between p-5 border-b">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-dim text-primary px-3 py-1 text-xs">
              <Sparkles className="h-3 w-3" />
              {QUESTION.subject}
            </span>
            <div className="relative h-12 w-12">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="22" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                <circle
                  cx="25" cy="25" r="22" fill="none"
                  stroke={ringColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-mono">
                {timeLeft}
              </span>
            </div>
          </div>

          <div className="p-6">
            <p className="text-base font-medium leading-relaxed mb-5">{QUESTION.text}</p>
            <div className="space-y-2">
              {QUESTION.options.map((opt, i) => {
                const isCorrect = i === QUESTION.correctIndex;
                const isSelected = selected === i;
                let cls = "border-border bg-surface-hi/40 hover:border-primary/50 hover:bg-primary/5";
                if (revealed && isCorrect) cls = "border-[color:var(--score-strong)] bg-[color:var(--score-strong)]/10";
                else if (revealed && isSelected && !isCorrect) cls = "border-destructive bg-destructive/10";

                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={revealed}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-[10px] border-[1.5px] text-sm transition-colors disabled:cursor-default",
                      cls
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-3">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div className="mt-5 rounded-[10px] bg-primary-dim border-l-[3px] border-primary px-4 py-3 text-sm leading-relaxed">
                <p className="text-xs font-medium text-primary mb-1 uppercase tracking-widest">Explanation</p>
                <p>{QUESTION.explanation}</p>
              </div>
            )}

            {revealed && (
              <button
                onClick={reset}
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Try again
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ */
/*  Test Carousel                                                */
/* ------------------------------------------------------------ */
function SectionTestCarousel() {
  return (
    <section className="relative py-24 lg:py-[96px]">
      <div className="px-6 lg:px-[72px] mb-10 max-w-[1280px] mx-auto">
        <p className="text-[11px] font-medium uppercase tracking-widest text-primary">A peek at our library</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl text-balance">
          Hundreds of tests, <em className="text-primary">already curated.</em>
        </h2>
      </div>

      <div className="relative overflow-hidden group">
        <div className="flex gap-[18px] whitespace-nowrap animate-carousel group-hover:[animation-play-state:paused]">
          {[...TESTS, ...TESTS].map((t, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[300px] rounded-[18px] border bg-surface overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="h-1" style={{ background: SUBCOLOR[t.sub] || "var(--primary)" }} />
              <div className="p-5">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {t.cls} · {t.sub}
                </p>
                <h3 className="mt-2 font-display text-lg whitespace-normal leading-snug">{t.name}</h3>
                <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                  <span>{t.q} Qs</span>
                  <span>·</span>
                  <span>{t.time}m</span>
                  <span>·</span>
                  <span>{t.marks} marks</span>
                </div>
                {t.score !== null && (
                  <div className="mt-3 rounded-[10px] bg-primary-dim px-3 py-2 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Your best</span>
                    <span className="font-mono text-primary">{t.score}%</span>
                  </div>
                )}
                <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm">
                  <span className={t.free ? "text-[color:var(--score-strong)]" : "text-foreground"}>
                    {t.free ? "Free" : `₹${t.price}`}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-primary">
                    {t.score !== null ? "View" : "Start"}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24" style={{ background: "linear-gradient(to right, var(--background), transparent)" }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24" style={{ background: "linear-gradient(to left, var(--background), transparent)" }} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ */
/*  Stats Counter                                                */
/* ------------------------------------------------------------ */
function SectionStatsCounter() {
  const a = useCountUp({ target: 28000 });
  const b = useCountUp({ target: 400 });
  const c = useCountUp({ target: 50000 });

  return (
    <section className="relative px-6 lg:px-[72px] pb-24">
      <div className="mx-auto max-w-[1280px] rounded-[28px] border bg-surface overflow-hidden">
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
          <Counter ringDelay={0} ref={a.ref} value={a.value} suffix="+" label="Practice questions" />
          <Counter ringDelay={0.9} ref={b.ref} value={b.value} suffix="+" label="Curated tests" />
          <Counter ringDelay={1.7} ref={c.ref} value={c.value} suffix="+" label="Students learning" />
        </div>
      </div>
    </section>
  );
}

function Counter({
  ref,
  value,
  suffix,
  label,
  ringDelay,
}: {
  ref: React.RefObject<HTMLElement | null>;
  value: number;
  suffix: string;
  label: string;
  ringDelay: number;
}) {
  return (
    <div className="relative px-8 py-12 text-center overflow-hidden">
      <div style={{ animationDelay: `${ringDelay}s` }}>
        <AchievementPulseRings
          anchor="center"
          color="oklch(0.65 0.17 145 / 0.6)"
          ringCount={2}
          duration={3.4}
          size={50}
        />
      </div>
      <p className="relative font-display text-5xl md:text-6xl">
        <span ref={ref as React.RefObject<HTMLSpanElement>}>{value.toLocaleString("en-IN")}</span>
        <span className="text-primary">{suffix}</span>
      </p>
      <p className="relative mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------ */
/*  Pricing                                                      */
/* ------------------------------------------------------------ */
function SectionPricing() {
  return (
    <section id="pricing" className="relative py-24 lg:py-[96px] px-6 lg:px-[72px] overflow-hidden">
      <DriftingFormulas opacity={0.07} />
      <div className="relative mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-primary">Pricing</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-balance">
            Start free. <em className="text-primary">Pay only when it helps.</em>
          </h2>
          <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-md">
            Sample tests are completely free. Detailed solutions and full chapter tests unlock with paid tests or bundles.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-6 py-3.5 text-sm font-bold shadow-gold transition-transform hover:-translate-y-0.5"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-[22px] border bg-surface px-8 py-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Free tier</p>
          <ul className="mt-4 space-y-3">
            {["Sample tests for every chapter", "Untimed practice mode", "Score tracking & history", "Subject-wise analytics", "Personalised dashboard"].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Paid tier — unlocked when you buy</p>
            <ul className="mt-4 space-y-3">
              {["Detailed step-by-step solutions", "Full chapter tests", "Lifetime access on per-test buys", "Unlimited retakes"].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <span className="text-primary mt-0.5">★</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ */
/*  FAQ                                                          */
/* ------------------------------------------------------------ */
function SectionFaq() {
  const items = [
    { q: "Which boards do you cover?", a: "We currently support CBSE, ICSE, and State Boards for Class 6 through Class 12. Pick your board when you sign up." },
    { q: "Do I have to pay to start?", a: "No. Sample tests are completely free. You only pay when you want detailed solutions or unlock the full library." },
    { q: "How do paid tests differ from free?", a: "Paid tests include detailed step-by-step solutions, explanations, and full coverage of chapters. Free tests show your score only." },
    { q: "Can I take the same test multiple times?", a: "Yes. Question order is randomized each attempt, so you can retake to improve. Some tests have a cooldown period we configure." },
    { q: "What happens if I lose internet during a test?", a: "Your answers are saved continuously. Just pause and resume from where you left — no progress lost." },
  ];

  return (
    <section id="faq" className="relative py-24 lg:py-[96px] px-6 lg:px-[72px]">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <p className="text-[11px] font-medium uppercase tracking-widest text-primary">FAQ</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-balance">
            Questions, <em className="text-primary">answered.</em>
          </h2>
        </div>

        <div className="divide-y rounded-[22px] border bg-surface overflow-hidden">
          {items.map((item) => (
            <details key={item.q} className="group p-6 hover:bg-white/[0.02] transition-colors">
              <summary className="cursor-pointer list-none flex items-center justify-between text-base font-medium">
                <span className="pr-4">{item.q}</span>
                <span className="text-primary group-open:rotate-45 transition-transform text-2xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ */
/*  Final CTA                                                    */
/* ------------------------------------------------------------ */
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

          <div className="relative">
            <LogoMark className="h-12 w-12 mx-auto mb-6" />
            <h2 className="font-display text-4xl md:text-6xl text-balance">
              Your best exam <em className="text-primary">starts here.</em>
            </h2>
            <p className="mt-5 text-base text-muted-foreground max-w-md mx-auto">
              Free to try. Built for India. Loved by students.
            </p>
            <Link
              href="/signup"
              className="mt-9 inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-7 py-4 text-sm font-bold shadow-gold animate-pulse-gold"
            >
              Create your free account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
