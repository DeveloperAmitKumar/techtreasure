import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PricingActions from "@/components/PricingActions";

export const metadata = { title: "Pricing · TechTreasure" };

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href={user ? "/dashboard" : "/"} className="text-xl font-extrabold text-brand">TechTreasure</Link>
          <Link href={user ? "/dashboard" : "/login"} className="btn-secondary">{user ? "Dashboard" : "Sign in"}</Link>
        </header>
        <section className="mx-auto max-w-2xl py-14 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Plans</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Choose your pin capacity</h1>
          <p className="mt-4 text-neutral-600">Monthly pin credits for Pinterest publishing. AI credits are coming soon and are not included yet.</p>
        </section>
        <PricingActions signedIn={!!user} />
        <section className="mt-14 grid gap-4 md:grid-cols-3">
          <div className="card">
            <h2 className="font-semibold">Pin credits</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">One successful rendered pin uses one pin credit. Failed pins do not consume a credit. Free credits refill monthly; paid plan credits renew with the subscription.</p>
          </div>
          <div className="card">
            <h2 className="font-semibold">AI credits</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">AI credit purchases are coming soon. Until then, AI generation works only with your own Gemini API key saved in Settings.</p>
          </div>
          <div className="card">
            <h2 className="font-semibold">Trial</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">The ₹9 Lifetime Trial is a one-time purchase with 1,000 pin credits and can be redeemed once per account.</p>
          </div>
        </section>
        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="text-xl font-bold">Before you purchase</h2>
          <ul className="mt-4 grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
            <li>Razorpay handles payment details and recurring subscription mandates.</li>
            <li>Paid subscriptions renew monthly until cancelled.</li>
            <li>Credits have no cash value and cannot be transferred.</li>
            <li>Read the <Link href="/legal/payments" className="font-semibold text-brand hover:underline">Payments Terms</Link> for cancellation and refund rules.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
