"use client";

import Script from "next/script";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_CREDITS, PLANS, TRIAL_PLAN, type PlanId } from "@/lib/plans";
import Link from "next/link";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function PricingActions({ signedIn = false }: { signedIn?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedPayments, setAcceptedPayments] = useState(false);

  async function startSubscription(planId: PlanId) {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent("/pricing")}`);
      return;
    }
    if (!acceptedPayments) {
      setMessage("Please accept the Terms, Privacy Policy, and Payments Terms before checkout.");
      return;
    }
    setBusy(planId);
    setMessage(null);
    const response = await fetch("/api/razorpay/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setBusy(null);
      setMessage(data.error || "Unable to start checkout.");
      return;
    }
    if (!window.Razorpay) {
      setBusy(null);
      setMessage("Razorpay checkout is still loading. Try again in a moment.");
      return;
    }
    const checkout = new window.Razorpay({
      key: data.key,
      subscription_id: data.subscriptionId,
      name: "TechTreasure",
      description: data.description,
      theme: { color: "#e60023" },
    });
    checkout.open();
    setBusy(null);
  }

  async function startTrial() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent("/pricing")}`);
      return;
    }
    if (!acceptedPayments) {
      setMessage("Please accept the Terms, Privacy Policy, and Payments Terms before checkout.");
      return;
    }
    setBusy("trial");
    setMessage(null);
    const response = await fetch("/api/razorpay/create-trial-order", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setBusy(null);
      setMessage(data.error || "Unable to start checkout.");
      return;
    }
    if (!window.Razorpay) {
      setBusy(null);
      setMessage("Razorpay checkout is still loading. Try again in a moment.");
      return;
    }
    const checkout = new window.Razorpay({
      key: data.key,
      order_id: data.orderId,
      amount: data.amount,
      currency: "INR",
      name: "TechTreasure",
      description: TRIAL_PLAN.description,
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const verification = await fetch("/api/razorpay/verify-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }),
        });
        if (!verification.ok) {
          const data = await verification.json();
          setMessage(data.error || "Payment verification failed.");
          return;
        }
        router.refresh();
      },
      theme: { color: "#e60023" },
    });
    checkout.open();
    setBusy(null);
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <label className="mb-5 flex items-start gap-2 rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={acceptedPayments} onChange={(e) => setAcceptedPayments(e.target.checked)} />
        <span>I agree to the <Link href="/legal/terms" target="_blank" className="font-semibold text-brand hover:underline">Terms and Conditions</Link>, <Link href="/legal/privacy" target="_blank" className="font-semibold text-brand hover:underline">Privacy Policy</Link>, and <Link href="/legal/payments" target="_blank" className="font-semibold text-brand hover:underline">Payments Terms</Link>, including recurring billing and cancellation rules.</span>
      </label>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <article key={plan.id} className={`card flex flex-col ${plan.featured ? "border-brand ring-2 ring-brand/10" : ""}`}>
            <p className="text-sm font-semibold text-brand">{plan.name}</p>
            <p className="mt-3 text-3xl font-extrabold">₹{plan.priceInr}<span className="text-sm font-normal text-neutral-500"> / month</span></p>
            <p className="mt-3 text-sm text-neutral-600">{plan.description}</p>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-neutral-500">Pin credits</dt><dd className="font-semibold">{plan.id === "pro_max" ? "Unlimited*" : PLAN_CREDITS[plan.id].toLocaleString("en-IN")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-neutral-500">AI credits</dt><dd className="font-semibold text-amber-700">Coming soon</dd></div>
            </dl>
            <button className="btn-primary mt-auto pt-2" disabled={plan.id === "free" || busy !== null} onClick={() => startSubscription(plan.id)}>
              {busy === plan.id ? "Opening…" : plan.id === "free" ? "Current base plan" : "Choose plan"}
            </button>
          </article>
        ))}
      </div>
      <article className="card mt-6 border-dashed border-amber-300 bg-amber-50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="font-semibold">₹{TRIAL_PLAN.priceInr} {TRIAL_PLAN.name}</p><p className="text-sm text-neutral-700">{TRIAL_PLAN.pinCredits.toLocaleString("en-IN")} pin credits, one-time and once per account.</p></div>
          <button className="btn-secondary" disabled={busy !== null} onClick={startTrial}>{busy === "trial" ? "Opening…" : "Buy trial"}</button>
        </div>
      </article>
      <p className="mt-3 text-xs text-neutral-500">* Pro Max uses a configurable {PLAN_CREDITS.pro_max.toLocaleString("en-IN")} pin-credit monthly cap. AI credits are not purchasable yet. AI generation currently requires your own Gemini API key in Settings.</p>
      {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
    </>
  );
}
