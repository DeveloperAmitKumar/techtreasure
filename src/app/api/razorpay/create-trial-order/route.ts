import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRIAL_PLAN } from "@/lib/plans";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "Razorpay is not configured yet." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("trial_redemptions").select("user_id").eq("user_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ error: "The lifetime trial is available once per account." }, { status: 409 });

  const auth = `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: TRIAL_PLAN.priceInr * 100, currency: "INR", receipt: `trial_${user.id}_${Date.now()}`, notes: { user_id: user.id, plan_id: "trial" } }),
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data.error?.description ?? "Razorpay order failed." }, { status: 502 });
  return NextResponse.json({
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    orderId: data.id,
    amount: data.amount,
  });
}
