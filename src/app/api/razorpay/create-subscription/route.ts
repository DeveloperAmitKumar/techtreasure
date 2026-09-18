import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlan, type PlanId } from "@/lib/plans";

function razorpayAuth(): string {
  return `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const plan = getPlan(String(body.planId ?? "")) as ReturnType<typeof getPlan> & { id: PlanId };
  if (!plan || plan.id === "free" || !plan.razorpayPlanEnv) {
    return NextResponse.json({ error: "Invalid paid plan." }, { status: 400 });
  }
  const planId = process.env[plan.razorpayPlanEnv];
  if (!planId || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "Razorpay is not configured yet." }, { status: 503 });
  }

  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: { Authorization: razorpayAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ plan_id: planId, total_count: 120, customer_notify: 1, notes: { user_id: user.id, plan_id: plan.id } }),
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data.error?.description ?? "Razorpay subscription failed." }, { status: 502 });

  const admin = createAdminClient();
  await admin.from("profiles").update({ razorpay_subscription_id: data.id, pending_plan: plan.id }).eq("id", user.id);
  return NextResponse.json({ key: process.env.RAZORPAY_KEY_ID, subscriptionId: data.id, description: `${plan.name} monthly plan` });
}
