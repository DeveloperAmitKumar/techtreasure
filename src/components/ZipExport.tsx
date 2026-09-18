"use client";

import { useState } from "react";
import JSZip from "jszip";
import type { Pin } from "@/lib/types";
import { buildCsvRows, rowsToCsv } from "@/lib/csv";
import { Icon } from "./Icon";

interface Props {
  pins: Pin[];
  boardName: string;
  sourceLink: string;
  batchId: string;
}

function safeName(s: string, i: number): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${String(i + 1).padStart(3, "0")}-${slug || "pin"}.png`;
}

export default function ZipExport({
  pins,
  boardName,
  sourceLink,
  batchId,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function download() {
    if (pins.length === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: pins.length });
    try {
      const zip = new JSZip();
      const images = zip.folder("images")!;
      let done = 0;
      for (let i = 0; i < pins.length; i++) {
        try {
          const res = await fetch(pins[i].image_url);
          const blob = await res.blob();
          images.file(safeName(pins[i].title, i), blob);
        } catch {
          // Skip images that fail to download.
        }
        done++;
        setProgress({ done, total: pins.length });
      }
      zip.file(
        "pinterest-upload.csv",
        "\uFEFF" + rowsToCsv(buildCsvRows(pins, boardName, sourceLink))
      );
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `techtreasure-batch-${batchId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn-secondary" onClick={download} disabled={busy || pins.length === 0}>
      <Icon name="fluent-emoji-flat:file-folder" size={16} />
      {busy ? `Zipping ${progress.done}/${progress.total}…` : "Download ZIP"}
    </button>
  );
}
