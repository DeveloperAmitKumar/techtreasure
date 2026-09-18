import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.techtreasure.sbs";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL.replace(/\/$/, "");
  const now = new Date();
  const pages: Array<{ path: string; changeFrequency: "daily" | "weekly" | "monthly" | "yearly"; priority: number }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/login", changeFrequency: "yearly", priority: 0.3 },
    { path: "/signup", changeFrequency: "yearly", priority: 0.3 },
    { path: "/legal/terms", changeFrequency: "yearly", priority: 0.2 },
    { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.2 },
    { path: "/legal/payments", changeFrequency: "yearly", priority: 0.2 },
    // Dashboard (auth-required; listed for completeness, crawlers hit login redirect)
    { path: "/dashboard", changeFrequency: "daily", priority: 0.7 },
    { path: "/dashboard/brands", changeFrequency: "daily", priority: 0.6 },
    { path: "/dashboard/brands/new", changeFrequency: "monthly", priority: 0.4 },
    { path: "/dashboard/boards", changeFrequency: "daily", priority: 0.6 },
    { path: "/dashboard/boards/new", changeFrequency: "monthly", priority: 0.4 },
    { path: "/dashboard/batches", changeFrequency: "daily", priority: 0.6 },
    { path: "/dashboard/batches/new", changeFrequency: "daily", priority: 0.7 },
    { path: "/dashboard/guides", changeFrequency: "weekly", priority: 0.5 },
    { path: "/dashboard/settings", changeFrequency: "monthly", priority: 0.4 },
    { path: "/dashboard/report", changeFrequency: "monthly", priority: 0.4 },
  ];
  return pages.map((p) => ({
    url: `${base}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
