"use client";

import { downloadSampleCsv } from "@/lib/csvImport";
import type { ContentType } from "@/lib/types";
import { Icon } from "./Icon";

export default function SampleCsvButton({ type }: { type: ContentType }) {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => downloadSampleCsv(type)}
    >
      <Icon name="fluent-emoji-flat:outbox-tray" size={16} />
      Download {type} sample
    </button>
  );
}
