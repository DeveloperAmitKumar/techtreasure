// Supabase Edge Function: track-click
// Increments redirects.clicks for a given source_link. Called publicly (no JWT)
// from redirector.html, so deploy with --no-verify-jwt. Uses the service_role key.
// POST { source_link } -> { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { source_link } = await req.json();
    if (!source_link || typeof source_link !== "string") {
      return new Response(JSON.stringify({ error: "source_link required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: existing } = await supabase
      .from("redirects")
      .select("id, clicks")
      .eq("source_link", source_link)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("redirects")
        .update({ clicks: existing.clicks + 1 })
        .eq("id", existing.id);
    } else {
      await supabase.from("redirects").insert({ source_link, clicks: 1 });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
