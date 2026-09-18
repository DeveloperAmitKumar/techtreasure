"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SavedBoard } from "@/lib/types";

interface Props {
  initialBoard?: SavedBoard;
}

export default function BoardForm({ initialBoard }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialBoard?.name ?? "");
  const [description, setDescription] = useState(initialBoard?.description ?? "");
  const [pinterestUrl, setPinterestUrl] = useState(initialBoard?.pinterest_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Board name is required.");
      return;
    }
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated.");
      setSaving(false);
      return;
    }
    let opErr;
    if (initialBoard) {
      const { error: updErr } = await supabase
        .from("saved_boards")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          pinterest_url: pinterestUrl.trim() || null,
        })
        .eq("id", initialBoard.id);
      opErr = updErr;
    } else {
      const { error: insErr } = await supabase.from("saved_boards").insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        pinterest_url: pinterestUrl.trim() || null,
      });
      opErr = insErr;
    }
    setSaving(false);
    if (opErr) {
      setError(opErr.message);
      return;
    }
    router.push("/dashboard/boards");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-xl space-y-5">
      <div>
        <label className="label" htmlFor="name">
          Board name
        </label>
        <input
          id="name"
          required
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Daily Quotes"
        />
      </div>

      <div>
        <label className="label" htmlFor="pinterestUrl">
          Pinterest board URL <span className="text-neutral-400">(optional)</span>
        </label>
        <input
          id="pinterestUrl"
          type="url"
          className="input"
          value={pinterestUrl}
          onChange={(e) => setPinterestUrl(e.target.value)}
          placeholder="https://www.pinterest.com/username/board-name/"
        />
      </div>

      <div>
        <label className="label" htmlFor="description">
          Notes <span className="text-neutral-400">(optional)</span>
        </label>
        <textarea
          id="description"
          rows={4}
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this board for? Which niche / audience?"
        />
      </div>

      {name && (
        <div className="rounded-lg bg-neutral-50 p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Preview</p>
          <p className="mt-1 text-lg font-semibold">{name}</p>
          {pinterestUrl && (
            <a
              href={pinterestUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-xs text-brand hover:underline"
            >
              {pinterestUrl}
            </a>
          )}
          {description && (
            <p className="mt-2 text-sm text-neutral-600">{description}</p>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : initialBoard ? "Save changes" : "Save board"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.push("/dashboard/boards")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
