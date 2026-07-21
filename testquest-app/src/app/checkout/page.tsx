"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { StudentHeader } from "@/components/student/student-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Lock,
  Tag,
  X,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

interface ItemDetail {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  durationMinutes?: number;
  questionCount?: number;
  totalMarks?: number;
  validityDays?: number;
  testCount?: number;
}

interface CouponData {
  code: string;
  discount: number;
  finalPrice: number;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill: { name: string; email: string; contact?: string };
  theme: { color: string };
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemType = (searchParams.get("type") as "TEST" | "BUNDLE") || "TEST";
  const itemId = Number(searchParams.get("id"));

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [me, setMe] = useState<{ name: string; email: string; mobile?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponData | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    const url = itemType === "TEST" ? `/api/tests/${itemId}` : `/api/bundles/${itemId}`;
    const [itemRes, meRes] = await Promise.all([fetch(url), fetch("/api/auth/me")]);
    const itemData = await itemRes.json();
    const meData = await meRes.json();
    if (itemData.ok) setItem(itemData.data);
    if (meData.ok) setMe(meData.data);
    setLoading(false);
  }, [itemType, itemId]);

  useEffect(() => {
    if (itemId) fetchItem();
  }, [itemId, fetchItem]);

  async function applyCoupon() {
    if (!couponInput.trim() || !item) return;
    setCouponError(null);
    setCouponLoading(true);

    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponInput, itemType, itemId }),
    });
    const data = await res.json();

    if (!data.ok) {
      setCouponError(data.error || "Invalid coupon");
    } else {
      setCoupon({ code: data.data.code, discount: data.data.discount, finalPrice: data.data.finalPrice });
    }
    setCouponLoading(false);
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  async function pay() {
    if (!item) return;
    setProcessing(true);
    setError(null);

    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType, itemId, couponCode: coupon?.code }),
    });
    const data = await res.json();

    if (!data.ok) {
      setError(data.error || "Could not start checkout");
      setProcessing(false);
      return;
    }

    if (data.data.free) {
      router.push(`/checkout/success?orderId=${data.data.orderId}`);
      return;
    }

    const rzp = new window.Razorpay({
      key: data.data.razorpayKeyId,
      amount: data.data.amountInPaise,
      currency: data.data.currency,
      name: "Testquest",
      description: item.name,
      order_id: data.data.razorpayOrderId,
      handler: async (response) => {
        const verifyRes = await fetch("/api/orders/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: data.data.orderId,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          }),
        });
        const verifyData = await verifyRes.json();
        if (verifyData.ok) {
          router.push(`/checkout/success?orderId=${data.data.orderId}`);
        } else {
          setError("Payment verification failed. Please contact support.");
          setProcessing(false);
        }
      },
      prefill: { name: me?.name || "", email: me?.email || "", contact: me?.mobile || "" },
      theme: { color: "#6134EB" },
      modal: { ondismiss: () => setProcessing(false) },
    });

    rzp.open();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <StudentHeader />
        <div className="flex justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background">
        <StudentHeader />
        <div className="container mx-auto px-6 py-24 text-center max-w-md">
          <h2 className="font-display text-3xl tracking-tight">Item not found</h2>
          <Button asChild className="mt-6">
            <Link href="/tests">Back to tests</Link>
          </Button>
        </div>
      </div>
    );
  }

  const originalPrice = Number(item.price);
  const finalPrice = coupon ? coupon.finalPrice : originalPrice;

  return (
    <div className="min-h-screen bg-background">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <StudentHeader />

      <div className="container mx-auto px-6 py-10 max-w-4xl">
        <Link
          href={itemType === "TEST" ? `/tests/${itemId}` : "/tests"}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="ml-1">Back</span>
        </Link>

        <h1 className="font-display text-4xl md:text-5xl tracking-tight mb-8">Checkout.</h1>

        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          {/* Left — order details */}
          <div className="space-y-4">
            <div className="rounded-2xl border bg-surface shadow-soft p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-gold">
                  <Lock className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {itemType === "TEST" ? "Test" : "Bundle"}
                  </p>
                  <h2 className="mt-1 font-display text-2xl tracking-tight">{item.name}</h2>
                  {item.description && (
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  )}

                  {itemType === "TEST" && item.questionCount !== undefined && (
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{item.questionCount} questions</span>
                      <span>·</span>
                      <span>{item.durationMinutes} min</span>
                      <span>·</span>
                      <span>{item.totalMarks} marks</span>
                    </div>
                  )}
                  {itemType === "BUNDLE" && (
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{item.testCount} tests</span>
                      <span>·</span>
                      <span>{item.validityDays} days validity</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coupon */}
            <div className="rounded-2xl border bg-surface shadow-soft p-6">
              <h3 className="font-display text-xl tracking-tight mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Have a coupon?
              </h3>
              {coupon ? (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {coupon.code} applied
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">You save ₹{coupon.discount}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={removeCoupon}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      disabled={couponLoading}
                      className="h-11 font-mono"
                    />
                    <Button onClick={applyCoupon} disabled={couponLoading || !couponInput} variant="outline" className="h-11">
                      {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="mt-2 text-sm text-destructive">{couponError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Billing */}
            {me && (
              <div className="rounded-2xl border bg-surface shadow-soft p-6">
                <h3 className="font-display text-xl tracking-tight mb-4">Billing details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <p className="mt-1 font-medium">{me.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="mt-1 font-medium truncate">{me.email}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right — sticky order summary */}
          <aside className="md:sticky md:top-24 md:self-start">
            <div className="rounded-2xl border bg-surface shadow-lift overflow-hidden">
              <div className="p-6 border-b">
                <h3 className="font-display text-xl tracking-tight">Order summary</h3>
              </div>

              <div className="p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{originalPrice}</span>
                </div>
                {coupon && (
                  <div className="flex justify-between text-sm text-emerald-700">
                    <span>Discount ({coupon.code})</span>
                    <span>−₹{coupon.discount}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between items-baseline">
                  <span className="text-sm font-medium">Total</span>
                  <span className="font-display text-3xl tracking-tight">₹{finalPrice}</span>
                </div>
              </div>

              <div className="p-6 pt-0">
                {error && (
                  <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button onClick={pay} className="w-full h-12 text-base shadow-lift" size="lg" disabled={processing}>
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      {finalPrice === 0 ? "Get for free" : `Pay ₹${finalPrice}`}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  Secured by Razorpay
                </p>
              </div>

              {itemType === "BUNDLE" && (
                <div className="border-t p-6 space-y-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Access for {item.validityDays} days
                  </p>
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    All included tests unlocked
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
