import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isValidPackCredits,
  packPriceForCredits,
  PACK_MAX_CREDITS,
} from "@/lib/plans";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "Razorpay is not configured yet." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const credits = Number(body.credits);
  if (!isValidPackCredits(credits)) {
    return NextResponse.json(
      { error: `Pick 1,000–${PACK_MAX_CREDITS.toLocaleString("en-IN")} credits in 1,000 steps.` },
      { status: 400 }
    );
  }
  const priceInr = packPriceForCredits(credits);

  const auth = `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: priceInr * 100, currency: "INR", receipt: `pack_${user.id}_${Date.now()}`, notes: { user_id: user.id, plan_id: "pack", credits: String(credits) } }),
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data.error?.description ?? "Razorpay order failed." }, { status: 502 });
  return NextResponse.json({
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    orderId: data.id,
    amount: data.amount,
    credits,
    priceInr,
  });
}
