"use client";

import { useState } from "react";

export default function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={copy}>
      {copied ? "Copied" : "Copy prompt"}
    </button>
  );
}
