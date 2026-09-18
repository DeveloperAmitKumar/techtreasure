import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPackCredits, packPriceForCredits } from "@/lib/plans";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json();
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${body.orderId}|${body.paymentId}`).digest("hex");
  const actual = Buffer.from(String(body.signature ?? ""));
  const validSignature = actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), actual);
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
  }

  // Never trust the client's price — recompute from validated credits.
  const credits = Number(body.credits);
  if (!isValidPackCredits(credits)) {
    return NextResponse.json({ error: "Invalid credit amount." }, { status: 400 });
  }
  const priceInr = packPriceForCredits(credits);

  const admin = createAdminClient();
  const { error } = await admin.from("credit_pack_purchases").insert({ user_id: user.id, razorpay_order_id: body.orderId, razorpay_payment_id: body.paymentId, credits_granted: credits, amount_inr: priceInr });
  if (error?.code === "23505") return NextResponse.json({ error: "This payment was already credited." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: profile } = await admin.from("profiles").select("credits").eq("id", user.id).single();
  await admin.from("profiles").update({ credits: (profile?.credits ?? 0) + credits }).eq("id", user.id);
  return NextResponse.json({ ok: true, credits });
}
