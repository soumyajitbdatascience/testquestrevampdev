"use client";

/**
 * The paywall (design 3c) — bottom sheet on mobile, centered modal on desktop.
 * Opened from any locked item; remembers `returnTo` and sends the student back
 * to it after payment. Duration cards (12-month pre-selected), coupon with the
 * four states, honesty line with computed validity date, Razorpay handoff.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ShieldCheck, Tag, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan { id: number; durationMonths: number; price: number }
interface PlansPayload {
  boardName: string; className: string;
  plans: Plan[];
  counts: { subjects: number; tests: number; videos: number };
  passExpiresAt: string | null;
}
interface CouponState {
  status: "resting" | "open" | "applied" | "invalid" | "below_min";
  code: string;
  message?: string;
  discount?: number;
  finalPrice?: number;
  discountType?: string;
  discountValue?: number;
  maxDiscountCap?: number | null;
  minOrderValue?: number;
}

// window.Razorpay's global type is declared in checkout/page.tsx (prefill is
// required there); we pass prefill too, so reuse it as-is.

async function loadRazorpay(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Razorpay) return true;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function Paywall({
  open, onClose, boardId, classId, returnTo,
}: {
  open: boolean;
  onClose: () => void;
  boardId: number;
  classId: number;
  returnTo?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<PlansPayload | null>(null);
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [coupon, setCoupon] = useState<CouponState>({ status: "resting", code: "" });
  const [validating, setValidating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(null); setError(null);
    fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "paywall_open", properties: { boardId, classId, returnTo } }) }).catch(() => {});
    fetch("/api/auth/me").then((r) => r.json()).then((d) => d.ok && setMe({ name: d.data.name ?? "", email: d.data.email ?? "" }));
    fetch(`/api/plans?boardId=${boardId}&classId=${classId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error || "Plans unavailable"); return; }
        setData(d.data);
        const twelve = d.data.plans.find((p: Plan) => p.durationMonths === 12);
        setSelectedId(twelve?.id ?? d.data.plans[d.data.plans.length - 1]?.id ?? null);
      });
  }, [open, boardId, classId]);

  const selected = data?.plans.find((p) => p.id === selectedId) ?? null;
  const threeMoRate = useMemo(() => {
    const three = data?.plans.find((p) => p.durationMonths === 3);
    return three ? three.price / 3 : null;
  }, [data]);

  // Validity date: extends from current expiry when renewing
  const validUntil = useMemo(() => {
    if (!selected) return null;
    const base = data?.passExpiresAt && new Date(data.passExpiresAt) > new Date()
      ? new Date(data.passExpiresAt) : new Date();
    const d = new Date(base);
    d.setMonth(d.getMonth() + selected.durationMonths);
    return d;
  }, [selected, data]);

  const payAmount = coupon.status === "applied" && coupon.finalPrice != null
    ? coupon.finalPrice : selected?.price ?? 0;

  async function validateCoupon(code: string, planId: number) {
    setValidating(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, itemType: "B2C_PLAN", itemId: planId }),
      });
      const d = await res.json();
      if (d.ok) {
        fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "coupon_applied", properties: { code: d.data.code, planId } }) }).catch(() => {});
        setCoupon({
          status: "applied", code: d.data.code, discount: d.data.discount,
          finalPrice: d.data.finalPrice, discountType: d.data.discountType,
          discountValue: d.data.discountValue, maxDiscountCap: d.data.maxDiscountCap,
        });
      } else if (typeof d.error === "string" && d.error.startsWith("Minimum order value")) {
        setCoupon((c) => ({ ...c, status: "below_min", message: `${code} needs a ${d.error.toLowerCase()} — pick a longer pass to use it.` }));
      } else {
        setCoupon((c) => ({ ...c, status: "invalid", message: d.error || "Invalid code. Try another?" }));
      }
    } finally {
      setValidating(false);
    }
  }

  // Re-validate applied coupon when duration changes (min-order may invalidate)
  useEffect(() => {
    if (coupon.status === "applied" && coupon.code && selectedId) {
      validateCoupon(coupon.code, selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function pay() {
    if (!selected) return;
    setPaying(true); setError(null);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "B2C_PLAN", itemId: selected.id,
          couponCode: coupon.status === "applied" ? coupon.code : undefined,
        }),
      });
      const d = await res.json();
      if (!d.ok) { setError(d.error || "Could not start checkout"); setPaying(false); return; }
      const success = `/pass/success?orderId=${d.data.orderId}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`;
      if (d.data.free) { router.push(success); return; }

      const ok = await loadRazorpay();
      if (!ok) { setError("Could not load the payment window. Check your connection."); setPaying(false); return; }
      const rzp = new window.Razorpay({
        key: d.data.razorpayKeyId,
        amount: d.data.amountInPaise,
        currency: "INR",
        name: "TestQuest",
        description: `${data?.boardName} · ${data?.className} — ${selected.durationMonths}-month pass`,
        order_id: d.data.razorpayOrderId,
        prefill: { name: me?.name ?? "", email: me?.email ?? "" },
        theme: { color: "#6134EB" },
        modal: { ondismiss: () => setPaying(false) },
        handler: async (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const v = await fetch("/api/orders/verify", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: d.data.orderId,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpayOrderId: resp.razorpay_order_id,
              razorpaySignature: resp.razorpay_signature,
            }),
          });
          const vd = await v.json();
          if (vd.ok) router.push(success);
          else { setError(vd.error || "Payment verification failed"); setPaying(false); }
        },
      });
      rzp.open();
    } catch {
      setError("Something went wrong. Please try again.");
      setPaying(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-[620px] max-h-[92vh] overflow-y-auto bg-card rounded-t-[20px] sm:rounded-[20px] shadow-lift motion-safe:animate-in motion-safe:slide-in-from-bottom sm:motion-safe:zoom-in-95 motion-safe:duration-200">
        {/* grabber (mobile) */}
        <div className="sm:hidden pt-2 flex justify-center"><div className="h-1 w-9 rounded-full bg-border" /></div>
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8">
          {!data ? (
            <div className="flex justify-center py-16">
              {error ? <p className="text-sm text-error">{error}</p> : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            </div>
          ) : (
            <>
              <h2 className="font-display text-[22px] sm:text-2xl font-bold text-ink">
                Unlock {data.boardName} · {data.className}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                All {data.counts.subjects} subjects · {data.counts.tests} chapter-wise tests
                {data.counts.videos > 0 && <> · {data.counts.videos} video lessons</>}
              </p>

              {/* Duration cards */}
              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                {data.plans.map((p) => {
                  const perMonth = Math.round(p.price / p.durationMonths);
                  const save = threeMoRate && p.durationMonths > 3
                    ? Math.round((1 - p.price / p.durationMonths / threeMoRate) * 100) : 0;
                  const active = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "relative flex sm:flex-col items-center sm:items-start justify-between gap-1 rounded-[14px] border px-4 py-3.5 min-h-[56px] text-left transition-colors",
                        active ? "border-2 border-primary bg-wash" : "border-border hover:border-primary/40",
                      )}
                    >
                      {p.durationMonths === 12 && (
                        <span className="absolute -top-2.5 left-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Best value</span>
                      )}
                      <span>
                        <span className="block text-sm font-semibold text-ink">{p.durationMonths} months</span>
                        <span className="block text-[11px] text-text-secondary">₹{perMonth}/month</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {save > 0 && (
                          <span className="rounded-full bg-success-tint px-2 py-0.5 text-[10px] font-bold text-success">Save {save}%</span>
                        )}
                        <span className="font-display text-[17px] font-bold text-ink">₹{p.price}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Coupon */}
              <div className="mt-4">
                {coupon.status === "resting" && (
                  <button onClick={() => setCoupon({ status: "open", code: "" })} className="text-sm text-primary hover:underline underline-offset-4 inline-flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Have a coupon code?
                  </button>
                )}
                {(coupon.status === "open" || coupon.status === "invalid" || coupon.status === "below_min") && (
                  <div>
                    <div className="flex gap-2">
                      <input
                        value={coupon.code}
                        onChange={(e) => setCoupon({ status: "open", code: e.target.value.toUpperCase() })}
                        placeholder="COUPON CODE"
                        className={cn(
                          "h-11 flex-1 rounded-[11px] border bg-card px-3 text-sm font-semibold uppercase tracking-wide outline-none focus:border-2 focus:border-primary",
                          coupon.status === "invalid" && "border-2 border-error",
                        )}
                      />
                      <button
                        onClick={() => selectedId && validateCoupon(coupon.code, selectedId)}
                        disabled={validating || !coupon.code}
                        className="h-11 rounded-[11px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                    {coupon.status === "invalid" && <p className="mt-1.5 text-xs text-error">{coupon.message}</p>}
                    {coupon.status === "below_min" && (
                      <p className="mt-1.5 rounded-md bg-warning-tint px-2.5 py-1.5 text-xs text-warning">{coupon.message}</p>
                    )}
                  </div>
                )}
                {coupon.status === "applied" && selected && (
                  <div className="rounded-[14px] border border-success bg-success-tint p-3.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-success">Coupon {coupon.code} applied</span>
                      <button onClick={() => setCoupon({ status: "resting", code: "" })} className="text-xs text-text-secondary hover:underline">Remove</button>
                    </div>
                    <div className="mt-2 space-y-1 text-[13px] text-ink">
                      <div className="flex justify-between"><span>{selected.durationMonths}-month pass</span><span>₹{selected.price}</span></div>
                      <div className="flex justify-between text-success">
                        <span>
                          {coupon.discountType === "PERCENT"
                            ? `${coupon.discountValue}% off${coupon.maxDiscountCap ? ` (max ₹${coupon.maxDiscountCap})` : ""}`
                            : "Discount"}
                        </span>
                        <span>− ₹{coupon.discount}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 font-bold">
                        <span>You pay</span><span>₹{coupon.finalPrice}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Honesty line */}
              {validUntil && (
                <div className="mt-4 flex items-start gap-2.5 rounded-[14px] bg-wash p-3.5 text-[13px] text-text-secondary">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                  <span>
                    One-time payment. Valid until <strong className="text-ink">{fmtDate(validUntil)}</strong>.{" "}
                    <strong className="text-success">No auto-renewal.</strong>
                    {data.passExpiresAt && new Date(data.passExpiresAt) > new Date() && (
                      <> Days add on after your current pass — you never lose time.</>
                    )}
                  </span>
                </div>
              )}

              {error && <p className="mt-3 text-sm text-error">{error}</p>}

              <button
                onClick={pay}
                disabled={paying || !selected}
                className="mt-5 h-[50px] w-full rounded-[14px] bg-primary text-base font-bold text-primary-foreground shadow-[0_6px_18px_rgba(97,52,235,.35)] disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Pay ₹{payAmount} <ArrowRight className="h-4 w-4" /></>)}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-text-secondary">
                <Lock className="h-3 w-3" /> Secured by Razorpay · UPI, cards, netbanking
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
