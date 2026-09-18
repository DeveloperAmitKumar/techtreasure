import { NextResponse } from "next/server";

// Server-side Pexels search proxy — keeps PEXELS_API_KEY off the client.
// GET /api/pexels?query=tech&per_page=10
// → { query, urls: string[] }
export async function GET(request: Request) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Pexels is not configured yet (missing PEXELS_API_KEY)." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim().slice(0, 100);
  if (!query) {
    return NextResponse.json({ error: "query is required." }, { status: 400 });
  }
  const perPage = Math.max(
    1,
    Math.min(10, Number(searchParams.get("per_page") ?? "10") || 10)
  );

  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&per_page=${perPage}&orientation=portrait&size=large`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Pexels search failed (${res.status}). ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }
  const data = await res.json().catch(() => null);
  const photos: unknown[] = Array.isArray(data?.photos) ? data.photos : [];
  const urls = photos
    .map((p) => {
      const src = (p as { src?: Record<string, unknown> })?.src;
      const pick =
        src?.large2x ?? src?.large ?? src?.medium ?? src?.original ?? null;
      return typeof pick === "string" ? pick : null;
    })
    .filter((u): u is string => !!u);

  return NextResponse.json({ query, urls });
}
