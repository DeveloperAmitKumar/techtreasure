// Shared profile-balance reads for server components.
//
// Reads both credit pools, but stays working on databases where the
// `ai_credits` migration hasn't run yet: if selecting the new column fails,
// it falls back to the legacy single pool and reports it for both balances.
// Run this once in Supabase SQL Editor to get the real split pools:
//   alter table public.profiles
//     add column if not exists ai_credits int not null default 20
//     check (ai_credits >= 0);

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_CREDITS } from "./plans";

export interface ProfileBalances {
  plan: string;
  email: string | null;
  language: string;
  credits: number;
  ai_credits: number;
  gemini_api_key: string | null;
  use_custom_gemini_key: boolean;
  /** False when the ai_credits column is missing (single-pool fallback). */
  splitCredits: boolean;
}

function normalize(row: any, aiCredits: number, split: boolean, useCustomKey: boolean): ProfileBalances {
  return {
    plan: row.plan ?? "free",
    email: row.email ?? null,
    language: row.language ?? "en",
    credits: row.credits ?? 0,
    ai_credits: aiCredits,
    gemini_api_key: row.gemini_api_key ?? null,
    use_custom_gemini_key: useCustomKey,
    splitCredits: split,
  };
}

export async function getProfileBalances(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileBalances | null> {
  const full = await supabase
    .from("profiles")
    .select("plan, email, language, credits, ai_credits, gemini_api_key, use_custom_gemini_key, credits_reset_at")
    .eq("id", userId)
    .single();
  if (!full.error && full.data) {
    if (full.data.plan === "free" && full.data.credits_reset_at) {
      const resetAt = new Date(full.data.credits_reset_at);
      const resetDue = resetAt.getTime() <= Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (resetDue) {
        await supabase.from("profiles").update({ credits: PLAN_CREDITS.free, ai_credits: 0, credits_reset_at: new Date().toISOString() }).eq("id", userId);
        full.data.credits = PLAN_CREDITS.free;
        full.data.ai_credits = 0;
      }
    }
    return normalize(full.data, full.data.ai_credits ?? 0, true, full.data.use_custom_gemini_key ?? true);
  }
  // Pre-migration database (or any select failure): retry without the new
  // column so at least the real single-pool balance shows.
  const basic = await supabase
    .from("profiles")
    .select("plan, email, language, credits, gemini_api_key")
    .eq("id", userId)
    .single();
  if (basic.error || !basic.data) return null;
  const shared = basic.data.credits ?? 0;
  return normalize(basic.data, shared, false, true);
}
