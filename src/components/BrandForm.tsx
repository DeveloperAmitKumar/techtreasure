"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND_ICONS, FONTS, type Brand } from "@/lib/types";
import { Icon } from "./Icon";

interface Props {
  initialBrand?: Brand;
}

export default function BrandForm({ initialBrand }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialBrand?.name ?? "");
  const [logoUrl, setLogoUrl] = useState(initialBrand?.logo_url ?? "");
  const [iconName, setIconName] = useState(
    initialBrand?.icon_name ?? BRAND_ICONS[0]
  );
  const [textColor, setTextColor] = useState(initialBrand?.text_color ?? "#ffffff");
  const [bgColor, setBgColor] = useState(initialBrand?.bg_color ?? "#e60023");
  const [font, setFont] = useState(initialBrand?.font ?? FONTS[0]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated.");
      setUploading(false);
      return;
    }
    const path = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error: upErr } = await supabase.storage
      .from("logos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    if (initialBrand) {
      const { error: updErr } = await supabase
        .from("brands")
        .update({
          name,
          logo_url: logoUrl || null,
          icon_name: iconName || null,
          text_color: textColor,
          bg_color: bgColor,
          font,
        })
        .eq("id", initialBrand.id);
      opErr = updErr;
    } else {
      const { error: insErr } = await supabase.from("brands").insert({
        user_id: user.id,
        name,
        logo_url: logoUrl || null,
        icon_name: iconName || null,
        text_color: textColor,
        bg_color: bgColor,
        font,
      });
      opErr = insErr;
    }
    setSaving(false);
    if (opErr) {
      setError(opErr.message);
      return;
    }
    router.push("/dashboard/brands");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-xl space-y-5">
      <div>
        <label className="label" htmlFor="name">
          Brand name
        </label>
        <input
          id="name"
          required
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Logo</label>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo preview"
              className="h-14 w-14 rounded-md border border-neutral-200 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-neutral-300 text-xs text-neutral-400">
              <Icon name={iconName} size={32} title="Brand icon" />
            </div>
          )}
          <label className="btn-secondary cursor-pointer">
            {uploading ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
        </div>
        <input
          className="input mt-2"
          placeholder="…or paste a logo URL"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
        />
        <div className="mt-3">
          <p className="label">Fallback icon</p>
          <p className="mb-2 text-xs text-neutral-500">
            Used in pins and brand cards when no logo image is available.
          </p>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
            {BRAND_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                aria-label={`Choose ${icon.split(":")[1].replaceAll("-", " ")}`}
                title={icon}
                onClick={() => setIconName(icon)}
                className={`flex h-10 items-center justify-center rounded-md border ${
                  iconName === icon
                    ? "border-brand bg-brand/10 ring-2 ring-brand/30"
                    : "border-neutral-200 bg-white hover:bg-neutral-50"
                }`}
              >
                <Icon name={icon} size={25} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="textColor">
            Default text color
          </label>
          <input
            id="textColor"
            type="color"
            className="h-10 w-full cursor-pointer rounded-md border border-neutral-300"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="bgColor">
            Default background color
          </label>
          <input
            id="bgColor"
            type="color"
            className="h-10 w-full cursor-pointer rounded-md border border-neutral-300"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="font">
          Default font
        </label>
        <select
          id="font"
          className="input"
          value={font}
          onChange={(e) => setFont(e.target.value)}
        >
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f.split(",")[0].replace(/['"]/g, "")}
            </option>
          ))}
        </select>
      </div>

      <div
        className="flex h-40 items-center justify-center rounded-lg p-6 text-center text-2xl font-bold"
        style={{ background: bgColor, color: textColor, fontFamily: font }}
      >
        {name || "Preview"}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save brand"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.push("/dashboard/brands")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
