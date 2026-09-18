"use client";

import { type ContentType, type PinItem } from "./types";
import {
  TEXT_COL,
  LINK_COL,
  BG_COL,
  parseTagsInput,
  samplesForMode,
  rowHasFullDetails,
  missingDetails,
  type SkippedRow,
} from "./csvImport";
import { resolveBgInput } from "./backgrounds";

export interface JsonImportResult {
  items: PinItem[];
  skipped: SkippedRow[];
  /** JSON syntax/shape error (null when the JSON itself is valid). */
  error: string | null;
}

function isUrl(v: string): boolean {
  return /^https?:\/\/.+/i.test(v.trim());
}

// Parses a pasted/uploaded JSON array into PinItems. Same column contract as
// CSV (quote/headline/fact required; author/link/bg_url optional). Rows with
// a missing required cell — or an invalid URL in an optional cell — are
// skipped entirely and reported, mirroring the CSV importer.
export function parseImportJson(
  raw: string,
  contentType: ContentType,
  opts?: { requireFullDetails?: boolean }
): JsonImportResult {
  if (!raw.trim()) return { items: [], skipped: [], error: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { items: [], skipped: [], error: `Invalid JSON: ${(err as Error).message}` };
  }
  if (!Array.isArray(data)) {
    return { items: [], skipped: [], error: "JSON must be an array of objects." };
  }

  const items: PinItem[] = [];
  const skipped: SkippedRow[] = [];
  const textCol = TEXT_COL[contentType];
  const linkCol = LINK_COL[contentType];
  const bgCol = BG_COL[contentType];

  data.forEach((entry, i) => {
    const rowNum = i + 1;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      skipped.push({ row: rowNum, reason: "not an object" });
      return;
    }
    // Case-insensitive keys, string values only.
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
      row[k.toLowerCase()] = typeof v === "string" ? v.trim() : "";
    }

    const text = row[textCol] ?? "";
    if (!text) {
      skipped.push({ row: rowNum, reason: `missing "${textCol}"` });
      return;
    }
    const link = row[linkCol] ?? "";
    if (link && !isUrl(link)) {
      skipped.push({ row: rowNum, reason: `invalid "${linkCol}" URL` });
      return;
    }
    // Background: URL, "default", a Library name ("Sunset"/"Stock 5"),
    // or free text ("tech", "a boy standing") → Pexels search at generation.
    const bgRaw = (row[bgCol] ?? "").trim();
    const bgResolved = resolveBgInput(bgRaw);
    const bgQuery = !bgResolved.ok && bgRaw.length > 0 ? bgRaw.slice(0, 100) : undefined;

    const str = (v: unknown): string | undefined => {
      const s = typeof v === "string" ? v.trim() : "";
      return s.length > 0 ? s : undefined;
    };
    const rec = entry as Record<string, unknown>;
    const item: PinItem = {
      text,
      author: contentType === "quote" ? row["author"] || undefined : undefined,
      link: link || undefined,
      bgUrl: bgResolved.ok ? bgResolved.url : undefined,
      bgQuery,
      title: str(rec["title"]),
      description: str(rec["description"]),
      tags: parseTagsInput(rec["tags"]),
      cta: str(rec["cta"])?.slice(0, 80),
      mainLine: str(rec["main_line"])?.slice(0, 300),
      source: str(rec["source"])?.slice(0, 120),
      imageTitle: str(rec["image_title"])?.slice(0, 100),
      imageDescription: str(rec["image_description"])?.slice(0, 500),
      headline: contentType === "news" ? text.slice(0, 300) : undefined,
    };
    if (opts?.requireFullDetails && !rowHasFullDetails(item, contentType)) {
      skipped.push({
        row: rowNum,
        reason: `needs full details in Without-AI mode (missing: ${missingDetails(item, contentType).join(", ")})`,
      });
      return;
    }
    items.push(item);
  });

  return { items, skipped, error: null };
}

// Pretty-printed sample array for a content type. Without-AI samples carry
// full details; With-AI samples only the basic fields.
export function buildSampleJson(contentType: ContentType, withoutAI = false): string {
  return JSON.stringify(samplesForMode(contentType, withoutAI), null, 2);
}
