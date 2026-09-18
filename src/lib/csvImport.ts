"use client";

import Papa from "papaparse";
import { resolveBgInput } from "./backgrounds";
import { CSV_SPECS, type ContentType, type PinItem } from "./types";

export interface SkippedRow {
  row: number; // 1-based data row (excluding header)
  reason: string;
}

export interface ImportResult {
  items: PinItem[];
  skipped: SkippedRow[];
}

function isUrl(v: string): boolean {
  return /^https?:\/\/.+/i.test(v.trim());
}

// Column aliases per content type → canonical PinItem fields.
export const TEXT_COL: Record<ContentType, string> = {
  quote: "quote",
  news: "headline",
  fact: "fact",
};export const LINK_COL: Record<ContentType, string> = {
  quote: "link",
  news: "source_link",
  fact: "link",
};
export const BG_COL: Record<ContentType, string> = {
  quote: "bg_url",
  news: "image_url",
  fact: "bg_url",
};

// Tags arrive as a comma/semicolon-separated string (CSV/paste) or an array
// (JSON). Anything else yields no tags.
export function parseTagsInput(v: unknown): string[] {
  const arr = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(/[;,]/)
      : [];
  return arr.map((t) => String(t ?? "").trim()).filter((t) => t.length > 0);
}

const nonEmpty = (v: string | undefined): string | undefined =>
  v && v.trim().length > 0 ? v.trim() : undefined;

// Detail columns filled per row (override AI) vs basic columns (AI fills rest).
export const DETAIL_COLUMNS = ["title", "description", "tags", "main_line", "cta"];

export function columnsForMode(contentType: ContentType, withoutAI: boolean): string[] {
  const cols = CSV_SPECS[contentType].columns;
  return withoutAI ? cols : cols.filter((c) => !DETAIL_COLUMNS.includes(c));
}

export function samplesForMode(
  contentType: ContentType,
  withoutAI: boolean
): Record<string, string>[] {
  const rows = CSV_SPECS[contentType].samples;
  if (withoutAI) return rows;
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).filter(([k]) => !DETAIL_COLUMNS.includes(k))
    )
  );
}

// Which AI-fillable details a row is missing (quotes render `text`, so they
// never need main_line). Empty = the row is fully specified, no AI call needed.
export function missingDetails(item: PinItem, contentType: ContentType): string[] {
  const missing: string[] = [];
  if (contentType === "news") {
    if (!item.title?.trim()) missing.push("title (Pinterest)");
    if (!item.description?.trim()) missing.push("description (Pinterest)");
    if (!item.imageTitle?.trim()) missing.push("image_title");
    if (!item.imageDescription?.trim()) missing.push("image_description");
    return missing;
  }
  if (!item.title?.trim()) missing.push("title");
  if (!item.description?.trim()) missing.push("description");
  if ((item.tags ?? []).filter((t) => t.trim()).length === 0) missing.push("tags");
  if (!item.mainLine?.trim()) missing.push("main_line");
  if (!item.cta?.trim()) missing.push("cta");
  return missing;
}

export function rowHasFullDetails(item: PinItem, contentType: ContentType): boolean {
  return missingDetails(item, contentType).length === 0;
}

// Parses an uploaded CSV. Any row with an invalid/missing required cell — or an
// invalid URL in an optional cell — is skipped entirely (never partially used).
// With `requireFullDetails` (Without-AI mode), rows missing any AI-fillable
// detail are skipped as well, since no AI call will fill them.
export function parseImportCsv(
  text: string,
  contentType: ContentType,
  opts?: { requireFullDetails?: boolean }
): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const items: PinItem[] = [];
  const skipped: SkippedRow[] = [];
  const textCol = TEXT_COL[contentType];
  const linkCol = LINK_COL[contentType];
  const bgCol = BG_COL[contentType];

  parsed.data.forEach((raw, i) => {
    const rowNum = i + 1;
    const row: Record<string, string> = {};
    for (const k of Object.keys(raw)) row[k] = (raw[k] ?? "").trim();

    // Required text cell.
    const text = row[textCol];
    if (!text) {
      skipped.push({ row: rowNum, reason: `missing "${textCol}"` });
      return;
    }

    // Optional URL cells: if present but invalid, skip the whole row.
    const link = row[linkCol] ?? "";
    if (link && !isUrl(link)) {
      skipped.push({ row: rowNum, reason: `invalid "${linkCol}" URL` });
      return;
    }
    // Background cell: URL, "default", a Library name ("Sunset"/"Stock 5"),
    // or free text ("tech", "a boy standing") → Pexels search at generation.
    const bgRaw = (row[bgCol] ?? "").trim();
    const bgResolved = resolveBgInput(bgRaw);
    // Free text that is not a URL/default/Library name becomes a Pexels query
    // instead of skipping the row. Empty = batch default.
    const bgQuery = !bgResolved.ok && bgRaw.length > 0 ? bgRaw.slice(0, 100) : undefined;

    const item: PinItem = {
      text,
      author: row["author"] || undefined,
      link: link || undefined,
      bgUrl: bgResolved.ok ? bgResolved.url : undefined,
      bgQuery,
      title: nonEmpty(row["title"]),
      description: nonEmpty(row["description"]),
      tags: parseTagsInput(row["tags"]),
      cta: nonEmpty(row["cta"])?.slice(0, 80),
      mainLine: nonEmpty(row["main_line"])?.slice(0, 300),
      source: nonEmpty(row["source"])?.slice(0, 120),
      imageTitle: nonEmpty(row["image_title"])?.slice(0, 100),
      imageDescription: nonEmpty(row["image_description"])?.slice(0, 500),
      headline: contentType === "news" ? text.slice(0, 300) : undefined,
    };
    items.push(item);
    if (opts?.requireFullDetails) {
      const missing = missingDetails(item, contentType);
      if (missing.length > 0) {
        items.pop();
        skipped.push({
          row: rowNum,
          reason: `needs full details in Without-AI mode (missing: ${missing.join(", ")})`,
        });
        return;
      }
    }
  });

  return { items, skipped };
}

// Builds a downloadable sample CSV for a content type. Without-AI samples
// carry full details; With-AI samples only the basic columns.
export function buildSampleCsv(contentType: ContentType, withoutAI = false): string {
  return Papa.unparse(samplesForMode(contentType, withoutAI), {
    columns: columnsForMode(contentType, withoutAI),
  });
}

export function downloadSampleCsv(contentType: ContentType, withoutAI = false) {
  const csv = buildSampleCsv(contentType, withoutAI);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `techtreasure-sample-${contentType}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parses a pasted "one per line" list into PinItems. Pipe-separated per-row
// details (empty = AI default; background also accepts "default"/Library names):
//   quote:    text | author | link | bg | title | description | tags | cta
//   news:    headline | link | bg | image_title | image_description | title | description | source
//   fact:    text | link | bg | title | description | tags | cta | main_line
// A line without "|" is just the text (previous behavior, unchanged).
export function parsePastedList(text: string, contentType: ContentType): PinItem[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length === 1) {
        return { text: parts[0] } as PinItem;
      }
      // [text, ...rest] where rest positions depend on the content type.
      const rest = parts.slice(1);
      const get = (n: number): string | undefined =>
        rest[n] && rest[n].length > 0 ? rest[n] : undefined;
      const linkRaw = contentType === "quote" ? get(1) : get(0);
      const bgRaw = contentType === "quote" ? get(2) : get(1);
      const bgResolved = resolveBgInput(bgRaw ?? "");
      const bgText = (bgRaw ?? "").trim();
      const bgQuery = !bgResolved.ok && bgText.length > 0 ? bgText.slice(0, 100) : undefined;
      const detail = (n: number): string | undefined => {
        const v = get(n);
        return v && v.length > 0 ? v : undefined;
      };
      const base: PinItem = {
        text: parts[0],
        link: linkRaw && isUrl(linkRaw) ? linkRaw : undefined,
        bgUrl: bgResolved.ok ? bgResolved.url : undefined,
        bgQuery,
      };
      if (contentType === "quote") {
        return {
          ...base,
          author: get(0),
          title: detail(3),
          description: detail(4),
          tags: parseTagsInput(get(5) ?? ""),
          cta: detail(6)?.slice(0, 80),
        };
      }
      return {
        ...base,
        title: contentType === "news" ? detail(5) : detail(2),
        description: contentType === "news" ? detail(6) : detail(3),
        ...(contentType === "news"
          ? {
              headline: parts[0].slice(0, 300),
              imageTitle: detail(2)?.slice(0, 100),
              imageDescription: detail(3)?.slice(0, 500),
              source: detail(7)?.slice(0, 120),
            }
          : {
              tags: parseTagsInput(get(4) ?? ""),
              cta: detail(5)?.slice(0, 80),
              mainLine: detail(6)?.slice(0, 300),
            }),
      };
    })
    .filter((it) => it.text);
}
