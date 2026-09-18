import { NextResponse } from "next/server";

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "supabase.co" ||
    host.endsWith(".supabase.co") ||
    // Curated stock-photo backgrounds for the Library tab.
    host === "images.unsplash.com" ||
    host === "plus.unsplash.com"
  );
}

export async function GET(req: Request) {
  const source = new URL(req.url).searchParams.get("url");
  if (!source) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(source);
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  if (imageUrl.protocol !== "https:" || !isAllowedHost(imageUrl.hostname)) {
    return NextResponse.json({ error: "Image host is not allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Image source returned ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Source is not an image" }, { status: 415 });
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to fetch image" }, { status: 502 });
  }
}