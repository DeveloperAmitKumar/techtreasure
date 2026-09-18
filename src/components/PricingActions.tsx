"use client";

import Script from "next/script";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_CREDITS, PLANS, TRIAL_PLAN, CREDIT_PACKS, packPriceForCredits, isValidPackCredits, PACK_MAX_CREDITS, PACK_MIN_CREDITS, PACK_CREDIT_STEP, type PlanId } from "@/lib/plans";
import Link from "next/link";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function PricingActions({ signedIn = false, trialRedeemed = false }: { signedIn?: boolean; trialRedeemed?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedPayments, setAcceptedPayments] = useState(false);
  const [redeemed, setRedeemed] = useState(trialRedeemed);
  const [congrats, setCongrats] = useState<{ credits: number; label: string } | null>(null);
  const [customCredits, setCustomCredits] = useState("2000");

  async function startSubscription(planId: PlanId) {
    const plan = PLANS.find((p) => p.id === planId);
    if (plan && plan.available === false) {
      setMessage(`${plan.name} is temporarily unavailable. Please get the ₹9 Lifetime Trial instead.`);
      return;
    }
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
        setBusy(null);
        setRedeemed(true);
        setCongrats({ credits: TRIAL_PLAN.pinCredits, label: `₹${TRIAL_PLAN.priceInr} ${TRIAL_PLAN.name}` });
        router.refresh();
      },
      theme: { color: "#e60023" },
    });
    checkout.open();
    setBusy(null);
  }

  async function startPack(credits: number, busyId: string) {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent("/pricing")}`);
      return;
    }
    if (!acceptedPayments) {
      setMessage("Please accept the Terms, Privacy Policy, and Payments Terms before checkout.");
      return;
    }
    if (!isValidPackCredits(credits)) {
      setMessage(`Pick ${PACK_MIN_CREDITS.toLocaleString("en-IN")}–${PACK_MAX_CREDITS.toLocaleString("en-IN")} credits in ${PACK_CREDIT_STEP.toLocaleString("en-IN")} steps.`);
      return;
    }
    setBusy(busyId);
    setMessage(null);
    const response = await fetch("/api/razorpay/create-pack-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits }),
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
    const packCredits: number = data.credits;
    const checkout = new window.Razorpay({
      key: data.key,
      order_id: data.orderId,
      amount: data.amount,
      currency: "INR",
      name: "TechTreasure",
      description: `${packCredits.toLocaleString("en-IN")} pin credits top-up`,
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const verification = await fetch("/api/razorpay/verify-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            credits: packCredits,
          }),
        });
        if (!verification.ok) {
          const data = await verification.json();
          setMessage(data.error || "Payment verification failed.");
          return;
        }
        setBusy(null);
        setCongrats({ credits: packCredits, label: `${packCredits.toLocaleString("en-IN")} credits top-up` });
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
      <article className={`card relative mb-6 overflow-hidden ${redeemed ? "border-green-300 bg-gradient-to-br from-green-50 via-white to-white ring-2 ring-green-200" : "border-brand bg-gradient-to-br from-amber-50 via-white to-white ring-2 ring-brand/20"}`}>
        <span className={`absolute right-4 top-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white ${redeemed ? "bg-green-600" : "bg-brand"}`}>
          {redeemed ? "Purchased ✓" : "Specially for you"}
        </span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">Limited one-time offer</p>
            <p className="mt-1 text-xl font-extrabold">₹{TRIAL_PLAN.priceInr} {TRIAL_PLAN.name}</p>
            <p className="mt-1 text-sm text-neutral-700"><span className="font-bold">{TRIAL_PLAN.pinCredits.toLocaleString("en-IN")} pin credits</span>, one-time and once per account.{redeemed ? " You already own this — credits are in your account." : " Pro plans are temporarily unavailable — top up here or with a pack below."}</p>
          </div>
          <button className="btn-primary w-full shrink-0 sm:w-auto" disabled={redeemed || busy !== null} onClick={startTrial}>{redeemed ? "Purchased — credits added" : busy === "trial" ? "Opening…" : `Claim ₹${TRIAL_PLAN.priceInr} trial`}</button>
        </div>
      </article>
      <section className="mt-6">
        <h2 className="text-lg font-bold">Top-up packs</h2>
        <p className="mt-1 text-sm text-neutral-600">One-time pin-credit packs. Buy as often as you like — credits add to your balance instantly. Max {PACK_MAX_CREDITS.toLocaleString("en-IN")} credits per order.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <article key={pack.id} className="card relative flex flex-col">
              {pack.tag && (
                <span className="absolute right-4 top-4 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  {pack.tag}
                </span>
              )}
              <p className="text-sm font-semibold text-brand">{pack.credits.toLocaleString("en-IN")} credits</p>
              <p className="mt-3 text-3xl font-extrabold">₹{pack.priceInr}<span className="text-sm font-normal text-neutral-500"> one-time</span></p>
              <p className="mt-3 text-sm text-neutral-600">Adds {pack.credits.toLocaleString("en-IN")} pin credits instantly. No expiry, no subscription.</p>
              <div className="mt-auto pt-4">
                <button className="btn-primary w-full" disabled={busy !== null} onClick={() => startPack(pack.credits, pack.id)}>
                  {busy === pack.id ? "Opening…" : `Buy ${pack.credits.toLocaleString("en-IN")}`}
                </button>
              </div>
            </article>
          ))}
          <article className="card flex flex-col border-dashed">
            <p className="text-sm font-semibold text-brand">Custom amount</p>
            <p className="mt-3 text-3xl font-extrabold">₹{packPriceForCredits(Number(customCredits) || 0)}<span className="text-sm font-normal text-neutral-500"> one-time</span></p>
            <label className="mt-3 text-sm text-neutral-600">
              Credits ({PACK_MIN_CREDITS.toLocaleString("en-IN")}–{PACK_MAX_CREDITS.toLocaleString("en-IN")}, steps of {PACK_CREDIT_STEP.toLocaleString("en-IN")})
              <input
                type="number"
                className="input mt-1"
                min={PACK_MIN_CREDITS}
                max={PACK_MAX_CREDITS}
                step={PACK_CREDIT_STEP}
                value={customCredits}
                onChange={(e) => setCustomCredits(e.target.value)}
              />
            </label>
            <div className="mt-auto pt-4">
              <button className="btn-secondary w-full" disabled={busy !== null} onClick={() => startPack(Number(customCredits), "pack_custom")}>
                {busy === "pack_custom" ? "Opening…" : "Buy custom"}
              </button>
            </div>
          </article>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const unavailable = plan.available === false;
          return (
          <article key={plan.id} className={`card relative flex flex-col ${plan.featured ? "border-brand ring-2 ring-brand/10" : ""} ${unavailable ? "opacity-75" : ""}`}>
            {unavailable && (
              <span className="absolute right-4 top-4 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                Temporarily unavailable
              </span>
            )}
            <p className="text-sm font-semibold text-brand">{plan.name}</p>
            <p className="mt-3 text-3xl font-extrabold">₹{plan.priceInr}<span className="text-sm font-normal text-neutral-500"> / month</span></p>
            <p className="mt-3 text-sm text-neutral-600">{plan.description}</p>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-neutral-500">Pin credits</dt><dd className="font-semibold">{plan.id === "pro_max" ? "Unlimited*" : PLAN_CREDITS[plan.id].toLocaleString("en-IN")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-neutral-500">AI credits</dt><dd className="font-semibold text-amber-700">Coming soon</dd></div>
            </dl>
            <div className="mt-auto pt-4">
            <button className="btn-primary w-full" disabled={plan.id === "free" || unavailable || busy !== null} onClick={() => startSubscription(plan.id)}>
              {unavailable ? "Temporarily unavailable" : busy === plan.id ? "Opening…" : plan.id === "free" ? "Current base plan" : "Choose plan"}
            </button>
            </div>
          </article>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-neutral-500">* Pro Max uses a configurable {PLAN_CREDITS.pro_max.toLocaleString("en-IN")} pin-credit monthly cap. AI credits are not purchasable yet. AI generation currently requires your own Gemini API key in Settings.</p>
      {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
      {congrats && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Purchase successful">
          <div className="card w-full max-w-md space-y-4 border-green-200 text-center ring-2 ring-green-200">
            <p className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">🎉</p>
            <h2 className="text-xl font-extrabold">Congratulations!</h2>
            <p className="text-sm text-neutral-700">
              You got <span className="font-bold">{congrats.credits.toLocaleString("en-IN")} pin credits</span> with the {congrats.label}. They are already added to your account — start your first batch now.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setCongrats(null)}>
                Stay here
              </button>
              <Link href="/dashboard/batches/new" className="btn-primary w-full sm:w-auto">
                Create pins now
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
