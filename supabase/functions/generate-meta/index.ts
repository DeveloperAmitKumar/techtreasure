// Supabase Edge Function: generate-meta
// Calls Google Gemini 3.6 Flash with the caller's own key. AI credits and
// shared-key generation are coming soon, so a custom key is required.
// POST { content_type, language, input } -> { title, description, tags, main_line, cta }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const MODEL = "gemini-3.6-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function buildPrompt(contentType: string, language: string, input: string): string {
  return `You are a Pinterest SEO expert. Create metadata for a single Pinterest pin.

Content type: ${contentType}
Language: ${language} (write ALL output fields in this language)
Source content: ${input}

Return ONLY valid JSON, no markdown fences, with exactly these keys:
- "title": an SEO-friendly pin title, max 100 characters
- "description": an engaging pin description with keywords, max 500 characters
- "tags": an array of 5-10 relevant keyword strings
- "main_line": the single most impactful line of text to render large on the pin image (max 12 words)
- "cta": a short call-to-action for the pin (max 5 words, e.g. "Read more")`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJson(text: string): any {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

async function callGemini(prompt: string, ownKey?: string | null): Promise<any> {
  // A user-supplied key takes priority and is the only key tried (their quota).
  const useOwn = !!ownKey && ownKey.trim().length > 0;
  if (!useOwn) throw new Error("AI generation is coming soon. Add your own Gemini API key in Settings.");
  let lastError: unknown;
  for (let attempt = 0; attempt < 1; attempt++) {
    const key = ownKey!.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
        }),
      });
      if (!res.ok) {
        const responseText = await res.text();
        lastError = new Error(`Gemini ${res.status}: ${responseText}`);
        // Gemini can briefly throttle consecutive requests. Give the same key
        // a short chance to recover before rotating to the next shared key.
        if (res.status === 429 || res.status >= 500) {
          await wait(1500 * (attempt + 1));
        }
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return parseJson(text);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("All Gemini keys failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { content_type, language, input } = await req.json();
    if (!content_type || !input) {
      return new Response(
        JSON.stringify({ error: "content_type and input are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Prefer the caller's own key (RLS: they can only read their own profile).
    const { data: profile } = await supabase
      .from("profiles")
      .select("gemini_api_key")
      .eq("id", user.id)
      .single();
    const ownKey = (profile?.gemini_api_key as string | null) ?? null;
    if (!ownKey?.trim()) {
      return new Response(JSON.stringify({ error: "AI generation is coming soon. Add your own Gemini API key in Settings." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const meta = await callGemini(
      buildPrompt(content_type, language || "en", input),
      ownKey
    );

    const result = {
      title: String(meta.title ?? "").slice(0, 100),
      description: String(meta.description ?? "").slice(0, 500),
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
      main_line: String(meta.main_line ?? ""),
      cta: String(meta.cta ?? ""),
    };

    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
