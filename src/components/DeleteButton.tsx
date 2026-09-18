"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";

interface Props {
  table: "brands" | "batches" | "saved_boards";
  id: string;
  name: string;
  warn: string;
  redirectTo?: string;
}

export default function DeleteButton({
  table,
  id,
  name,
  warn,
  redirectTo,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm(`Delete "${name}"?\n\n${warn}\n\nThis cannot be undone.`))
      return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from(table).delete().eq("id", id);
    setBusy(false);
    if (error) {
      window.alert(`Delete failed: ${error.message}`);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      title="Delete"
    >
      <Icon name="fluent-emoji-flat:wastebasket" size={16} />
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
