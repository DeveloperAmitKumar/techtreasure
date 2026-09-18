"use client";

import Papa from "papaparse";
import type { Pin } from "./types";

export const CSV_HEADERS = [
  "Title",
  "Media URL",
  "Pinterest board",
  "Thumbnail",
  "Description",
  "Link",
  "Publish date",
  "Keywords",
] as const;

export type CsvRow = Record<(typeof CSV_HEADERS)[number], string>;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://techtreasure.sbs";

function redirectLink(sourceLink: string): string {
  return `${SITE_URL}/redirector.html?url=${encodeURIComponent(sourceLink)}`;
}

// scheduled_at → UTC "YYYY-MM-DDTHH:MM:SS" (Pinterest bulk-upload format).
function publishDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

function sanitizeKeywords(tags: string[] | null | undefined): string {
  if (!Array.isArray(tags)) return "";
  return tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
    .join(", ");
}

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function publishDateSafe(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return publishDate(iso);
}

export function buildCsvRows(pins: Pin[], boardName: string, sourceLink: string, opts?: { postImmediately?: boolean }): CsvRow[] {
  const safeBoard = typeof boardName === "string" && boardName.trim().length > 0 ? boardName.trim() : "TechTreasure Pins";
  const postImmediately = opts?.postImmediately === true;
  return pins.map((p) => {
    const mediaUrl = isValidHttpUrl(p.image_url) ? p.image_url : "";
    const pinSourceLink = p.source_link || sourceLink;
    const link = isValidHttpUrl(pinSourceLink) ? redirectLink(pinSourceLink) : "";
    return {
      Title: (p.title || "").slice(0, 100),
      "Media URL": mediaUrl,
      "Pinterest board": safeBoard,
      Thumbnail: "",
      Description: (p.description || "").slice(0, 500),
      Link: link,
      // Pinterest: blank Publish date = post immediately.
      "Publish date": postImmediately ? "" : publishDateSafe(p.scheduled_at),
      Keywords: sanitizeKeywords(p.tags),
    };
  });
}

export function rowsToCsv(rows: CsvRow[]): string {
  return Papa.unparse(rows, { columns: [...CSV_HEADERS] });
}

export function downloadCsv(csv: string, batchId: string) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `techtreasure-batch-${batchId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
