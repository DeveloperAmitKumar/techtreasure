"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";

interface Props {
  userId: string;
  hasKey: boolean;
  masked: string | null;
  useCustomKey: boolean;
}

export default function GeminiKeyForm({ userId, hasKey, masked, useCustomKey }: Props) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [localUseCustomKey, setLocalUseCustomKey] = useState(useCustomKey);

  async function save() {
    const key = value.trim();
    if (key.length < 20) {
      setMsg({ type: "error", text: "That doesn't look like a valid API key." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ gemini_api_key: key, use_custom_gemini_key: true })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }
    setValue("");
    setLocalUseCustomKey(true);
    setMsg({ type: "success", text: "API key saved. Your own key is now being used." });
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ gemini_api_key: null, use_custom_gemini_key: false })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }
    setLocalUseCustomKey(false);
    setMsg({ type: "success", text: "API key removed. You're back to shared credits." });
    router.refresh();
  }

  async function toggleUseCustomKey(next: boolean) {
    setToggleBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ use_custom_gemini_key: next })
      .eq("id", userId);
    setToggleBusy(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }
    setLocalUseCustomKey(next);
    setMsg({
      type: "success",
      text: next
        ? "Switched to using your own API key. No credits will be spent."
        : "Switched to using account credits.",
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm">
        {hasKey ? (
          <p className="flex items-center gap-2 text-green-700">
            <Icon name="fluent-emoji-flat:white-check-mark" size={16} />
            Your own key is active (<code>{masked}</code>).
            {localUseCustomKey
              ? " Currently using your API key — no credits spent."
              : " Currently using account credits instead."}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-neutral-600">
            <Icon name="fluent-emoji-flat:key" size={16} />
            No personal key yet — AI generation is currently unavailable.
            Add your own key to enable AI mode.
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="gk">
          Google Gemini API key
        </label>
        <input
          id="gk"
          type="password"
          autoComplete="off"
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="AIza… (paste your key)"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Get a free key at{" "}
          <a
            className="text-brand hover:underline"
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
          >
            Google AI Studio
          </a>
          . Stored privately on your profile (row-level security — only you can
          read it) and used server-side by the generate function.
        </p>
      </div>

      {hasKey && (
        <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Icon name="fluent-emoji-flat:coin" size={16} />
            <span className="text-sm text-neutral-700">
              Use account credits instead of my API key
            </span>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={!localUseCustomKey}
              disabled={toggleBusy}
              onChange={(e) => toggleUseCustomKey(!e.target.checked)}
            />
            <div className="h-5 w-9 rounded-full bg-neutral-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand peer-checked:after:translate-x-full peer-disabled:opacity-50"></div>
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save key"}
        </button>
        {hasKey && (
          <button className="btn-secondary" onClick={remove} disabled={busy}>
            Remove
          </button>
        )}
      </div>

      {msg && (
        <p
          className={
            msg.type === "error" ? "text-sm text-red-600" : "text-sm text-green-600"
          }
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
