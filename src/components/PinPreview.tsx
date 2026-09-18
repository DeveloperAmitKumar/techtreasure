"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { renderPin, probeImageUrl, type PinTextStyle } from "@/lib/renderPin";
import type { Brand, ContentType, GeneratedMeta, NewsTemplate } from "@/lib/types";

interface Props {
  brand: Brand;
  contentType?: ContentType;
  newsTemplate?: NewsTemplate;
  backgroundImageUrl?: string | null;
  backgroundBlur?: number | null;
  textStyle?: PinTextStyle | null;
  sampleMainLine?: string;
  sampleTitle?: string;
  sampleDescription?: string;
  sampleSource?: string;
  sampleCta?: string;
  author?: string | null;
}

export default function PinPreview({
  brand,
  contentType = "quote",
  newsTemplate = "magazine",
  backgroundImageUrl,
  backgroundBlur,
  textStyle,
  sampleMainLine,
  sampleTitle,
  sampleDescription,
  sampleSource,
  sampleCta,
  author,
}: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  // null = no logo set (or not checked yet); false = logo URL won't render.
  const [logoOk, setLogoOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!brand.logo_url) {
      setLogoOk(null);
      return;
    }
    let cancelled = false;
    setLogoOk(null);
    probeImageUrl(brand.logo_url).then((ok) => {
      if (!cancelled) setLogoOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [brand.logo_url]);

  const renderKey = useMemo(
    () =>
      JSON.stringify([
        brand,
        contentType,
        newsTemplate,
        backgroundImageUrl,
        backgroundBlur,
        textStyle,
        sampleMainLine,
        sampleTitle,
        sampleDescription,
        sampleSource,
        sampleCta,
        author,
      ]),
    [
      brand,
      contentType,
      newsTemplate,
      backgroundImageUrl,
      backgroundBlur,
      textStyle,
      sampleMainLine,
      sampleTitle,
      sampleDescription,
      sampleSource,
      sampleCta,
      author,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;

    const samples: Record<
      ContentType,
      { title: string; main: string; cta: string; description: string; source?: string }
    > = {
      quote: {
        title: sampleTitle || "Invent the Future",
        main:
          sampleMainLine ||
          "The best way to predict the future is to invent it.",
        cta: sampleCta || "Get Inspired",
        description:
          sampleDescription ||
          "A short preview description for rendering.",
      },
      news: {
        title:
          sampleTitle ||
          (newsTemplate === "newspaper"
            ? "Luxury fashion brands embrace sustainability with eco materials"
            : "Karbi Anglong Leader Named Candidate For Deputy Speaker"),
        main:
          sampleMainLine ||
          "Breakthrough telescope releases the sharpest image of a black hole yet.",
        cta: sampleCta || "Read More",
        description:
          sampleDescription ||
          (newsTemplate === "newspaper"
            ? "Luxury fashion houses are racing to adopt recycled fabrics, biodegradable dyes, and zero-waste patterns. Major runway collections for 2026 are already committing to 100% sustainable sourcing."
            : "Dr. Habbey Teron, MLA from the newly created Amri (ST) constituency, was on June 18 announced as the NDA's candidate for the post of Deputy Speaker of the Assam Legislative Assembly."),
        source: sampleSource || "Image Source: X",
      },
      fact: {
        title: sampleTitle || "Honey Never Spoils",
        main:
          sampleMainLine ||
          "Honey never spoils — edible honey was found inside ancient Egyptian tombs.",
        cta: sampleCta || "Learn More",
        description:
          sampleDescription ||
          "A short preview description for rendering.",
      },
    };

    const meta: GeneratedMeta = {
      title: samples[contentType].title,
      main_line: samples[contentType].main,
      cta: samples[contentType].cta,
      description: samples[contentType].description,
      source: samples[contentType].source,
      tags: [],
    };

    renderPin({
      brand,
      meta,
      contentType,
      newsTemplate: contentType === "news" ? newsTemplate : undefined,
      backgroundImageUrl,
      backgroundBlur,
      textStyle,
      author: contentType === "quote" ? author ?? "Preview Author" : null,
    })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        currentUrl = url;
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [
    renderKey,
    brand,
    contentType,
    newsTemplate,
    backgroundImageUrl,
    backgroundBlur,
    textStyle,
    sampleMainLine,
    sampleTitle,
    sampleDescription,
    sampleSource,
    sampleCta,
    author,
  ]);

  return (
    <div className="mx-auto w-full max-w-[280px] sm:max-w-[333px]">
      {objectUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={objectUrl}
          alt="Pin preview"
          className="aspect-[2/3] h-auto w-full rounded-md border border-neutral-200 object-cover shadow-sm"
        />
      ) : (
        <div className="flex aspect-[2/3] w-full items-center justify-center rounded-md border border-neutral-200 text-sm text-neutral-400">
          Rendering preview…
        </div>
      )}
      {!brand.logo_url && !brand.icon_name ? (
        <p className="mt-2 text-xs text-neutral-500">
          No logo on this brand — pins show the name only. Add one in{" "}
          <Link href="/dashboard/brands" className="underline">
            Brands → Edit
          </Link>
          .
        </p>
      ) : logoOk === false ? (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          Logo couldn&apos;t be loaded — pins will show the name only.
          Re-upload it in{" "}
          <Link href="/dashboard/brands" className="underline">
            Brands → Edit
          </Link>{" "}
          (pasted external image URLs are blocked; upload the file instead).
        </p>
      ) : null}
    </div>
  );
}
