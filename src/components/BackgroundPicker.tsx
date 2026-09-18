"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { gradientDataUri } from "@/lib/backgrounds";
import { STOCK_BGS } from "@/lib/stockBackgrounds";
import { Icon } from "./Icon";
import { useDebouncedState } from "@/lib/useDebouncedState";

type Tab = "upload" | "library";

export default function BackgroundPicker({
  open,
  initial = [],
  onClose,
  onApply,
}: {
  open: boolean;
  initial?: string[];
  onClose: () => void;
  onApply: (urls: string[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("library");
  const [selected, setSelected] = useState<string[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<string[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [gradC1Immediate, gradC1Debounced, setGradC1] = useDebouncedState("#ff512f", 60);
  const [gradC2Immediate, gradC2Debounced, setGradC2] = useDebouncedState("#dd2476", 60);

  const customGradientUri = gradientDataUri(gradC1Debounced, gradC2Debounced);

  useEffect(() => {
    if (open) setSelected(initial);
  }, [open, initial]);

  // Load the user's previously uploaded backgrounds so the Library tab
  // shows them in a "Yours" section (not just the built-in gradients).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadUploads() {
      setUploadsLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: files, error } = await supabase.storage
          .from("backgrounds")
          .list(user.id, { limit: 100 });
        if (error || !files || cancelled) return;
        const urls = files
          .filter((f) => /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(f.name))
          .map(
            (f) =>
              supabase.storage
                .from("backgrounds")
                .getPublicUrl(`${user.id}/${f.name}`).data.publicUrl
          );
        setUploads(urls);
      } finally {
        if (!cancelled) setUploadsLoading(false);
      }
    }
    void loadUploads();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function toggle(url: string) {
    setSelected((s) => (s.includes(url) ? s.filter((u) => u !== url) : [...s, url]));
  }

  async function onUpload(files: FileList) {
    setUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: upErr } = await supabase.storage
        .from("backgrounds")
        .upload(path, file, { contentType: file.type });
      if (!upErr) {
        const { data } = supabase.storage.from("backgrounds").getPublicUrl(path);
        added.push(data.publicUrl);
      }
    }
    if (added.length > 0) {
      // Show fresh uploads in the Library "Yours" section right away.
      setUploads((u) => [...added, ...u.filter((x) => !added.includes(x))]);
    }
    setSelected((s) => [...s, ...added]);
    setUploading(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card flex max-h-[85vh] w-full max-w-3xl flex-col p-0">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Icon name="fluent-emoji-flat:framed-picture" size={20} />
            Choose backgrounds
          </h2>
          <button onClick={onClose} className="btn-secondary px-3 py-1">
            Close
          </button>
        </div>

        <div className="flex gap-2 border-b border-neutral-100 px-4 py-3">
          {(["upload", "library"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? "btn-primary capitalize" : "btn-secondary capitalize"}
            >
              {t}
            </button>
          ))}
          <div className="ml-auto text-sm text-neutral-500">
            {selected.length} selected
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {tab === "upload" && (
            <div className="space-y-3">
              <div
                className={
                  "flex w-full cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed px-4 py-8 text-sm transition-colors " +
                  (dragging
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-neutral-300 bg-neutral-50 text-neutral-600 hover:border-neutral-400")
                }
                role="button"
                tabIndex={0}
                onClick={() =>
                  document.getElementById("bg-upload-input")?.click()
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    document.getElementById("bg-upload-input")?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragging(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (e.dataTransfer.files) {
                    await onUpload(e.dataTransfer.files);
                  }
                }}
              >
                <Icon
                  name={dragging ? "fluent-emoji-flat:open-file-folder" : "fluent-emoji-flat:framed-picture"}
                  size={24}
                />
                <div className="text-center">
                  <p className="font-medium">
                    {dragging ? "Drop images here" : "Drag & drop images here, or click to browse"}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Accepts JPG, PNG, WEBP, and other image formats.
                  </p>
                </div>
                <label className="btn-secondary w-fit cursor-pointer gap-2">
                  {uploading && (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400/40 border-t-neutral-700"
                      aria-hidden="true"
                    />
                  )}
                  {uploading ? "Uploading…" : "Upload images"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    id="bg-upload-input"
                    onChange={(e) => e.target.files && onUpload(e.target.files)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
              </div>
              <p className="text-xs text-neutral-500">
                Uploaded to your private <code>backgrounds</code> folder and added to the selection.
              </p>
            </div>
          )}

          {tab === "library" && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-neutral-700">
                  Yours
                </p>
                {uploadsLoading ? (
                  <p className="text-xs text-neutral-500">
                    Loading your uploads…
                  </p>
                ) : uploads.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {uploads.map((url) => (
                      <button
                        key={url}
                        onClick={() => toggle(url)}
                        className={
                          "relative aspect-[2/3] overflow-hidden rounded-md border-2 " +
                          (selected.includes(url) ? "border-brand" : "border-transparent")
                        }
                        title="Your upload"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Your upload" className="h-full w-full object-cover" />
                        <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">
                          Yours
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">
                    No uploads yet — add images in the Upload tab and they will
                    appear here.
                  </p>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-neutral-700">
                  Custom gradient
                </p>
                <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={gradC1Immediate}
                      onChange={(e) => setGradC1(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-md border border-neutral-300"
                      title="Gradient start color"
                    />
                    <input
                      type="color"
                      value={gradC2Immediate}
                      onChange={(e) => setGradC2(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-md border border-neutral-300"
                      title="Gradient end color"
                    />
                  </div>
                  <div
                    className="h-14 flex-1 rounded-md border border-neutral-200"
                    style={{
                      background: `linear-gradient(180deg, ${gradC1Immediate}, ${gradC2Immediate})`,
                    }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => toggle(customGradientUri)}
                    className={
                      selected.includes(customGradientUri)
                        ? "btn-primary shrink-0"
                        : "btn-secondary shrink-0"
                    }
                  >
                    {selected.includes(customGradientUri) ? "Added ✓" : "Add"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Pick any two colors — no need to scroll through presets.
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-neutral-700">
                  Stock photos ({STOCK_BGS.length})
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {STOCK_BGS.map((s) => (
                    <button
                      key={s.imageUrl}
                      onClick={() => toggle(s.imageUrl)}
                      className={
                        "relative aspect-[2/3] overflow-hidden rounded-md border-2 " +
                        (selected.includes(s.imageUrl)
                          ? "border-brand"
                          : "border-transparent")
                      }
                      title={s.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.thumbUrl}
                        alt={s.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">
            1 selected → used for all pins. Multiple → cycled per pin.
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => onApply([])}>
              Clear
            </button>
            <button className="btn-primary" onClick={() => onApply(selected)}>
              Apply {selected.length > 0 ? `(${selected.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
