"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

function SuccessContent() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center lg:px-6">
      <div>
        <div className="relative rounded-3xl border bg-surface shadow-lift p-10 overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-30" />
          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-dim border border-primary/30">
              <CheckCircle2 className="h-9 w-9 text-[color:var(--score-strong)]" />
            </div>
            <h1 className="mt-6 font-display text-3xl md:text-4xl tracking-tight">
              You're all set.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Your payment was successful and your access is activated. Time to put it to use.
            </p>

            <div className="mt-8 space-y-2">
              <Button asChild className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold" size="lg">
                <Link href="/dashboard">
                  <Sparkles className="h-4 w-4" />
                  Start a test
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
