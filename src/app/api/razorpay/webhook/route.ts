import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlan, PLAN_CREDITS, type PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET ?? "").update(raw).digest("hex");
  if (!signature || signature !== expected) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });

  const event = JSON.parse(raw) as { event: string; payload?: { subscription?: { entity?: Record<string, unknown> } } };
  const subscription = event.payload?.subscription?.entity;
  const userId = typeof subscription?.notes === "object" && subscription.notes !== null
    ? String((subscription.notes as Record<string, unknown>).user_id ?? "")
    : "";
  const planId = typeof subscription?.notes === "object" && subscription.notes !== null
    ? String((subscription.notes as Record<string, unknown>).plan_id ?? "") as PlanId
    : "";
  const plan = getPlan(planId);
  if (!userId || !plan) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  if (["subscription.activated", "subscription.charged"].includes(event.event)) {
    await admin.from("profiles").update({ plan: plan.id, credits: plan.pinCredits, ai_credits: 0, pending_plan: null }).eq("id", userId);
  } else if (["subscription.cancelled", "subscription.completed", "subscription.halted"].includes(event.event)) {
    await admin.from("profiles").update({ plan: "free", credits: PLAN_CREDITS.free, ai_credits: 0, pending_plan: null }).eq("id", userId);
  }
  return NextResponse.json({ ok: true });
}
