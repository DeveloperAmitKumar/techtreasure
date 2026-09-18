"use client";

// Client-side Pexels resolver with per-query caching.
// Free text from CSV/JSON bg columns (e.g. "tech", "a boy standing") is
// resolved to a real portrait image URL via /api/pexels at generation time.
// Results per query are cached (arrays), and callers pick different photos
// per pin occurrence for variety. Failures return null → brand-color fallback.

const urlCache = new Map<string, Promise<string[]>>();

function normalizeQuery(q: string): string | null {
  const t = q.trim().replace(/\s+/g, " ").slice(0, 100);
  if (t.length < 2) return null;
  if (/^https?:\/\//i.test(t)) return null;
  if (t.toLowerCase() === "default") return null;
  return t;
}

async function fetchUrls(query: string): Promise<string[]> {
  const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&per_page=10`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const urls = Array.isArray(data?.urls) ? data.urls : [];
  return urls.filter((u: unknown): u is string => typeof u === "string" && u.length > 0);
}

function getUrlsCached(query: string): Promise<string[]> {
  const key = query.toLowerCase();
  const hit = urlCache.get(key);
  if (hit) return hit;
  const p = fetchUrls(query).catch(() => [] as string[]);
  urlCache.set(key, p);
  return p;
}

/** Resolve a free-text query to one image URL (occurrence picks variety). */
export async function resolvePexelsImage(rawQuery: string, occurrence = 0): Promise<string | null> {
  const query = normalizeQuery(rawQuery);
  if (!query) return null;
  const urls = await getUrlsCached(query);
  if (urls.length === 0) return null;
  return urls[occurrence % urls.length];
}
