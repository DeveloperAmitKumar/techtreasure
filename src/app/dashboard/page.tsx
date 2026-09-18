import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TrialPromoPopup from "@/components/TrialPromoPopup";
import { TRIAL_PLAN } from "@/lib/plans";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ count: brandCount }, { count: batchCount }, { count: pinCount }] =
    await Promise.all([
      supabase.from("brands").select("*", { count: "exact", head: true }),
      supabase.from("batches").select("*", { count: "exact", head: true }),
      supabase.from("pins").select("*", { count: "exact", head: true }),
    ]);

  let trialRedeemed = false;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("trial_redemptions").select("user_id").eq("user_id", user.id).maybeSingle();
    trialRedeemed = !!data;
  } catch {
    trialRedeemed = false;
  }

  const stats = [
    { label: "Brands", value: brandCount ?? 0, href: "/dashboard/brands" },
    { label: "Batches", value: batchCount ?? 0, href: "/dashboard/batches" },
    { label: "Pins", value: pinCount ?? 0, href: "/dashboard/batches" },
  ];

  return (
    <div>
      {!trialRedeemed && <TrialPromoPopup variant="dashboard" />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <Link href="/dashboard/batches/new" className="btn-primary">
          + New batch
        </Link>
      </div>
      {!trialRedeemed && (
        <Link href="/pricing" className="card mt-6 block border-brand/30 bg-gradient-to-br from-amber-50 via-white to-white ring-1 ring-brand/20 hover:border-brand">
          <span className="inline-block rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Specially for you
          </span>
          <span className="mt-2 block text-base font-extrabold">₹{TRIAL_PLAN.priceInr} Lifetime Trial — {TRIAL_PLAN.pinCredits.toLocaleString("en-IN")} pin credits</span>
          <span className="mt-1 block text-sm text-neutral-600">One-time, once per account. Tap to claim →</span>
        </Link>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card hover:border-brand">
            <p className="text-sm text-neutral-500">{s.label}</p>
            <p className="mt-1 text-3xl font-extrabold">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="card mt-8">
        <h2 className="text-lg font-semibold">How it works</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-600">
          <li>Create a brand with your logo and default colors.</li>
          <li>
            Start a new batch: pick a topic or paste a list, choose content type
            and language.
          </li>
          <li>
            TechTreasure writes SEO metadata, renders 1000×1500 pin images, and
            schedules them.
          </li>
          <li>Export a Pinterest-ready CSV and bulk upload.</li>
        </ol>
      </div>
    </div>
  );
}
