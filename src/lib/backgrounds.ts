// Built-in background library. Presets can be local SVG gradients or remote
// image URLs. Both load through new Image() for the 1000x1500 pin canvas.

import { STOCK_BGS } from "./stockBackgrounds";

export interface BgPreset {
  name: string;
  c1?: string;
  c2?: string;
  imageUrl?: string;
}

export const BG_PRESETS: BgPreset[] = [
  { name: "Sunset", c1: "#ff512f", c2: "#dd2476" }
];

export function gradientDataUri(c1: string, c2: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1500" viewBox="0 0 1000 1500">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="1000" height="1500" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function presetToDataUri(p: BgPreset): string {
  if (p.imageUrl) return p.imageUrl;
  if (!p.c1 || !p.c2) {
    throw new Error(`Background preset "${p.name}" needs an imageUrl or both colors`);
  }
  return gradientDataUri(p.c1, p.c2);
}

export type BgResolution = { ok: true; url?: string } | { ok: false };

// Resolve a per-row background value from CSV/JSON/paste input:
// - empty or "default" → batch default (selected backgrounds, else brand color)
// - http(s) URL → used directly (validity is checked by the caller)
// - library name (case-insensitive), e.g. "Sunset" or "Stock 5" → library image
// - anything else → invalid
export function resolveLibraryBackground(name: string): string | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const stock = STOCK_BGS.find((s) => s.name.toLowerCase() === q);
  if (stock) return stock.imageUrl;
  const preset = BG_PRESETS.find((p) => p.name.toLowerCase() === q);
  if (preset) {
    try {
      return presetToDataUri(preset);
    } catch {
      return null;
    }
  }
  return null;
}

export function resolveBgInput(raw: unknown): BgResolution {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v || v.toLowerCase() === "default") return { ok: true };
  if (/^https?:\/\/.+/i.test(v)) return { ok: true, url: v };
  const lib = resolveLibraryBackground(v);
  return lib ? { ok: true, url: lib } : { ok: false };
}
