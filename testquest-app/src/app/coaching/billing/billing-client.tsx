"use client";

/**
 * Billing client — current-plan card + tier picker + Razorpay handoff.
 *
 * The Razorpay JS lib is loaded on-demand the first time the owner clicks
 * "Upgrade now" to avoid pulling it into every coaching page bundle.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Check, AlertTriangle, Loader2, ArrowRight, Sparkles, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanRow {
  id: number;
  name: string;
  pricingModel: string;
  basePrice: number;
  durationDays: number;
  featuresJson: unknown;
}

interface StateDTO {
  subscriptionId: number | null;
  status: string | null;
  planName: string | null;
  seatsPurchased: number;
  seatsUsed: number;
  expiresAt: string | null;
  daysLeft: number | null;
  banner: string;
  canAssign: boolean;
  hardLockout: boolean;
}

type RazorpayWindow = Window & {
  Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
};

declare const window: RazorpayWindow;

async function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

type BillingCycle = "MONTHLY" | "QUARTERLY" | "ANNUAL";
const CYCLES: { key: BillingCycle; label: string; hint: string }[] = [
  { key: "MONTHLY", label: "Monthly", hint: "billed every month" },
  { key: "QUARTERLY", label: "Quarterly", hint: "billed every 3 months" },
  { key: "ANNUAL", label: "Annual", hint: "billed yearly" },
];

export function BillingClient({ state, plans }: { state: StateDTO; plans: PlanRow[] }) {
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Recurring auto-renew (Task 4.1)
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [subscribing, setSubscribing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Pick a sensible default plan when none is chosen yet.
  useEffect(() => {
    if (selectedPlanId == null && plans.length > 0) {
      // Prefer "Pro" if it exists; otherwise the most expensive plan.
      const pro = plans.find((p) => p.name === "Pro");
      setSelectedPlanId(pro?.id ?? plans[plans.length - 1].id);
    }
  }, [plans, selectedPlanId]);

  const statusBadge = useMemo(() => {
    switch (state.status) {
      case "TRIAL":    return { label: "Trial",     className: "bg-primary-dim text-primary" };
      case "ACTIVE":   return { label: "Active",    className: "bg-[color:var(--score-strong)]/15 text-[color:var(--score-strong)]" };
      case "GRACE":    return { label: "Grace",     className: "bg-destructive/10 text-destructive" };
      case "EXPIRED":  return { label: "Expired",   className: "bg-destructive/15 text-destructive" };
      case "CANCELLED":return { label: "Cancelled", className: "bg-muted text-muted-foreground" };
      default:         return { label: "—",         className: "bg-muted text-muted-foreground" };
    }
  }, [state.status]);

  const expiresLine = state.expiresAt
    ? new Date(state.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  async function upgrade() {
    if (selectedPlanId == null) return;
    setPaying(true); setError(null);
    try {
      const ok = await loadRazorpay();
      if (!ok) { setError("Couldn't load Razorpay. Check your network and try again."); return; }

      const res = await fetch("/api/coaching/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Couldn't start checkout"); return; }

      const Razorpay = window.Razorpay!;
      const rzp = new Razorpay({
        key: data.data.razorpayKeyId,
        order_id: data.data.razorpayOrderId,
        amount: data.data.amountInPaise,
        currency: data.data.currency,
        name: "Testquest for centres",
        description: `${data.data.planName} · ${data.data.months} month${data.data.months === 1 ? "" : "s"}`,
        handler: async (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const v = await fetch("/api/coaching/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.data.orderId,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpayOrderId: resp.razorpay_order_id,
                razorpaySignature: resp.razorpay_signature,
              }),
            });
            const vd = await v.json();
            if (vd.ok) {
              window.location.assign("/coaching/dashboard");
            } else {
              setError(vd.error || "Payment received but activation failed. Contact support — your payment ID is " + resp.razorpay_payment_id + ".");
              setPaying(false);
            }
          } catch {
            setError("Payment received but we couldn't confirm activation. Contact support — your payment ID is " + resp.razorpay_payment_id + ".");
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
        theme: { color: "#e89b3c" },
      });
      rzp.open();
    } catch {
      setError("Something went wrong starting checkout.");
      setPaying(false);
    }
  }

  // Recurring auto-renew mandate (Task 4.1). Unlike the one-time `upgrade()`,
  // the webhook is the source of truth for activation/renewal, so there is no
  // client-side verify step here — once the owner authorises the mandate,
  // Razorpay auto-charges each cycle and our webhook flips the sub to ACTIVE.
  async function subscribe() {
    if (selectedPlanId == null) return;
    setSubscribing(true); setError(null); setNotice(null);
    try {
      const ok = await loadRazorpay();
      if (!ok) { setError("Couldn't load Razorpay. Check your network and try again."); return; }

      const res = await fetch("/api/coaching/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId, cycle }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Couldn't start the subscription."); return; }

      const Razorpay = window.Razorpay!;
      const rzp = new Razorpay({
        key: data.data.razorpayKeyId,
        subscription_id: data.data.razorpaySubscriptionId,
        name: "Testquest for centres",
        description: `Auto-renew · ${plans.find((p) => p.id === selectedPlanId)?.name ?? "Plan"} · ${cycle.toLowerCase()}`,
        handler: () => {
          // Mandate authorised. Activation is webhook-driven; show a friendly
          // pending notice and refresh so the GET reflects the new state.
          setNotice("Auto-renew set up. Your plan activates as soon as the first payment is confirmed.");
          setSubscribing(false);
          setTimeout(() => window.location.reload(), 1500);
        },
        modal: { ondismiss: () => setSubscribing(false) },
        theme: { color: "#e89b3c" },
      });
      rzp.open();
    } catch {
      setError("Something went wrong starting the subscription.");
      setSubscribing(false);
    }
  }

  return (
    <>
      {/* Current plan card */}
      <section className="mt-6 rounded-[18px] border bg-surface p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-widest",
              statusBadge.className,
            )}>
              {state.status === "GRACE" || state.status === "EXPIRED" ? <AlertTriangle className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
              {statusBadge.label}
            </span>
            <h2 className="mt-3 font-display text-2xl">{state.planName ?? "No plan"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.seatsUsed} / {state.seatsPurchased} seats used
              {" · "}
              <Calendar className="inline-block h-3.5 w-3.5 mr-1" />
              {state.status === "TRIAL" || state.status === "ACTIVE"
                ? `${state.daysLeft && state.daysLeft > 0 ? `${state.daysLeft} days left · ` : ""}renews ${expiresLine}`
                : state.status === "GRACE"
                  ? `Ended ${expiresLine} · grace period active`
                  : state.status === "EXPIRED"
                    ? `Expired ${expiresLine}`
                    : `Expires ${expiresLine}`}
            </p>
          </div>
        </div>

        {state.banner === "grace" && (
          <p className="mt-4 text-sm text-destructive">
            New assignments are paused. Upgrade below to resume.
          </p>
        )}
        {state.banner === "expired" && (
          <p className="mt-4 text-sm text-destructive">
            Subscription expired. Upgrade to regain access, or contact support.
          </p>
        )}
      </section>

      {/* Plan picker */}
      <section className="mt-10">
        <h2 className="font-display text-xl mb-4">Pick a plan</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const selected = selectedPlanId === p.id;
            const isCurrent = p.name === state.planName;
            const bullets = Array.isArray((p.featuresJson as { bullet?: string[] })?.bullet)
              ? (p.featuresJson as { bullet: string[] }).bullet
              : [];
            const priceLabel = p.basePrice === 0
              ? "Free"
              : p.pricingModel === "PER_SEAT"
                ? `₹${p.basePrice}/seat/mo`
                : `₹${p.basePrice}`;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlanId(p.id)}
                aria-pressed={selected}
                className={cn(
                  "text-left rounded-[18px] border bg-surface p-5 transition-all",
                  selected ? "border-primary shadow-gold" : "hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-display text-lg">{p.name}</p>
                  {isCurrent && (
                    <span className="text-[10px] uppercase tracking-widest text-primary">Current</span>
                  )}
                </div>
                <p className={cn("mt-2 font-display text-2xl", selected && "text-primary")}>{priceLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Billed for {Math.round(p.durationDays / 30)} {p.durationDays >= 365 ? "year" : "month" + (p.durationDays >= 60 ? "s" : "")}
                </p>
                {bullets.length > 0 && (
                  <ul className="mt-4 space-y-2 text-xs">
                    {bullets.slice(0, 5).map((b) => (
                      <li key={b} className="flex items-start gap-1.5">
                        <Check className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground/90">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-6 rounded-md bg-[color:var(--score-strong)]/10 border border-[color:var(--score-strong)]/20 px-3 py-2 text-sm text-[color:var(--score-strong)]">
          {notice}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={upgrade}
          disabled={selectedPlanId == null || paying || subscribing || plans.find((p) => p.id === selectedPlanId)?.basePrice === 0}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-6 py-3 text-sm font-bold shadow-gold disabled:opacity-50 transition-transform hover:-translate-y-0.5"
        >
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Pay once<ArrowRight className="h-4 w-4" /></>)}
        </button>
        <p className="text-xs text-muted-foreground">
          One-time payment for a single period — no auto-renew. You&apos;ll renew manually.
        </p>
      </div>

      {/* Auto-renew (recurring mandate) — Task 4.1 */}
      <section className="mt-8 rounded-[18px] border bg-surface p-5">
        <h3 className="font-display text-lg">Or set up auto-renew</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay automatically each cycle via a Razorpay mandate. Cancel any time — you keep the period you&apos;ve paid for.
        </p>

        <div className="mt-4 inline-flex rounded-[10px] border bg-background p-1">
          {CYCLES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCycle(c.key)}
              aria-pressed={cycle === c.key}
              className={cn(
                "px-4 py-1.5 text-xs rounded-[7px] transition-colors",
                cycle === c.key ? "bg-primary text-primary-foreground shadow-gold" : "text-muted-foreground hover:text-foreground",
              )}
              title={c.hint}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={subscribe}
            disabled={selectedPlanId == null || subscribing || paying || plans.find((p) => p.id === selectedPlanId)?.basePrice === 0}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-primary text-primary px-6 py-3 text-sm font-bold disabled:opacity-50 transition-transform hover:-translate-y-0.5"
          >
            {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Calendar className="h-4 w-4" />Subscribe &amp; auto-renew</>)}
          </button>
          <span className="text-xs text-muted-foreground">{CYCLES.find((c) => c.key === cycle)?.hint}</span>
        </div>
      </section>

      <p className="mt-12 text-[11px] text-muted-foreground">
        Trouble paying? Email <a className="text-primary underline underline-offset-2" href="mailto:support@testquest.in">support@testquest.in</a> and we&apos;ll sort it out.
      </p>
    </>
  );
}
