"use client";

import { useState } from "react";
import type { Pin } from "@/lib/types";
import { buildCsvRows, downloadCsv, rowsToCsv } from "@/lib/csv";

interface Props {
  pins: Pin[];
  boardName: string;
  sourceLink: string;
  batchId: string;
}

export default function CsvExport({
  pins,
  boardName,
  sourceLink,
  batchId,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  function build() {
    const rows = buildCsvRows(pins, boardName, sourceLink);
    return rowsToCsv(rows);
  }

  return (
    <div className="flex gap-2">
      <button
        className="btn-secondary"
        onClick={() => setPreview(preview ? null : build())}
        disabled={pins.length === 0}
      >
        {preview ? "Hide CSV" : "Preview CSV"}
      </button>
      <button
        className="btn-primary"
        onClick={() => downloadCsv(build(), batchId)}
        disabled={pins.length === 0}
      >
        Export CSV
      </button>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="card max-h-[80vh] w-full max-w-3xl overflow-auto">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">CSV preview</h2>
              <button className="btn-secondary" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-all rounded-md bg-neutral-900 p-4 text-xs text-neutral-100">
              {preview}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
