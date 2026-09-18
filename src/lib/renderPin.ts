"use client";

import type { Brand, ContentType, GeneratedMeta, NewsTemplate } from "./types";
import { FONTS } from "./types";

export const PIN_WIDTH = 1000;
export const PIN_HEIGHT = 1500;

// Default background-image blur in canvas pixels. 0 = off.
export const DEFAULT_BG_BLUR = 6;
export const MAX_BG_BLUR = 60;

export interface RenderOptions {
  brand: Brand;
  meta: GeneratedMeta;
  contentType?: ContentType;
  newsTemplate?: NewsTemplate;
  backgroundImageUrl?: string | null;
  author?: string | null;
  /** Background-image blur radius in px. Defaults to DEFAULT_BG_BLUR; 0/null disables. */
  backgroundBlur?: number | null;
  /** Batch-level text styling. All fields optional (sane defaults). */
  textStyle?: PinTextStyle | null;
}

// Batch-level text styling for pin rendering:
// - brandNameColor: brand-name header color (defaults to the brand text color)
// - bold / italic: headline + brand-name emphasis (defaults: bold on, italic off;
//   the quote attribution line stays italic as a typographic convention)
// - textBgColor: solid backdrop drawn behind the headline block (null = off)
// - headlineTextColor: big centered headline + attribution color (defaults to brand.text_color)
// - ctaTextColor / ctaBgColor / ctaBold: CTA pill overrides (all fall back to brand defaults)
// - textShadowEnabled: drop shadows on headline/attribution/brand-name (default on)
export interface PinTextStyle {
  brandNameColor?: string | null;
  bold?: boolean | null;
  italic?: boolean | null;
  textBgColor?: string | null;
  headlineTextColor?: string | null;
  ctaTextColor?: string | null;
  ctaBgColor?: string | null;
  ctaBold?: boolean | null;
  textShadowEnabled?: boolean | null;
}

let googleFontsInjected = false;

const GOOGLE_FONT_SET = new Set([
  "Inter",
  "Playfair Display",
  "Roboto Slab",
  "Poppins",
  "Lora",
  "Merriweather",
  "Montserrat",
  "Source Sans 3",
  "Oswald",
  "Libre Baskerville",
  "Nunito",
  "Raleway",
  "DM Sans",
  "Work Sans",
  "Space Grotesk",
  "Roboto",
  "Open Sans",
  "Quicksand",
  "Bebas Neue",
  "Abril Fatface",
  "Cormorant Garamond",
  "Dancing Script",
]);

function extractPrimaryFamily(fontStack: string): string {
  const first = fontStack.split(",")[0]?.trim() ?? "";
  return first.replace(/^['"]|['"]$/g, "");
}

function ensureGoogleFontsLoaded(): void {
  if (googleFontsInjected || typeof document === "undefined") return;
  googleFontsInjected = true;
  const families: string[] = [];
  for (const entry of FONTS) {
    const family = extractPrimaryFamily(entry);
    if (GOOGLE_FONT_SET.has(family)) {
      families.push(family);
    }
  }

  if (families.length === 0) return;

  const params = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`)
    .join("&");
  const href = `https://fonts.googleapis.com/css2?${params}&subset=latin&display=swap`;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

// Idempotent Google-Fonts injector + readiness gate for canvas text.
// Appends the <link rel="stylesheet"> exactly once (module-level guard)
// and awaits document.fonts.ready so canvas draws with real glyphs.
export async function loadFontsForRendering(): Promise<void> {
  ensureGoogleFontsLoaded();
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function canvasImageUrl(src: string): string {
  if (src.startsWith("data:") || src.startsWith("/")) return src;
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin === window.location.origin) return src;
    return `/api/image-proxy?url=${encodeURIComponent(url.href)}`;
  } catch {
    return src;
  }
}

function brandIconUrl(iconName: string | null | undefined): string | null {
  return iconName
    ? `https://api.iconify.design/${iconName}.svg?height=160`
    : null;
}

/** True when an image URL loads for canvas use (same path the renderer takes). */
export async function probeImageUrl(src: string): Promise<boolean> {
  try {
    await loadImage(canvasImageUrl(src));
    return true;
  } catch {
    return false;
  }
}

// Cover-fit an image onto the canvas (like CSS object-fit: cover).
// When blurPx > 0 the image is drawn oversized under a canvas blur filter
// so the softened edges never reveal transparency at the canvas border.
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  blurPx = 0
) {
  const scale = Math.max(w / img.width, h / img.height);
  let dw = img.width * scale;
  let dh = img.height * scale;
  let dx = (w - dw) / 2;
  let dy = (h - dh) / 2;
  if (blurPx > 0) {
    const pad = Math.ceil(blurPx * 2);
    dx -= pad;
    dy -= pad;
    dw += pad * 2;
    dh += pad * 2;
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
    ctx.filter = "none";
  } else {
    ctx.drawImage(img, dx, dy, dw, dh);
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Fits font size down until the wrapped text fits within maxLines / max height.
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontStack: string,
  weight: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  maxLines: number,
  fontStyle = ""
): { size: number; lines: string[] } {
  let size = startSize;
  while (size >= minSize) {
    ctx.font = `${fontStyle}${weight} ${size}px ${fontStack}`;
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
    size -= 4;
  }
  ctx.font = `${fontStyle}${weight} ${minSize}px ${fontStack}`;
  return { size: minSize, lines: wrapText(ctx, text, maxWidth) };
}

export async function renderPin(options: RenderOptions): Promise<Blob> {
  const { brand, meta, backgroundImageUrl, author } = options;
  const ct: ContentType = options.contentType ?? "quote";
  const blurPx =
    typeof options.backgroundBlur === "number"
      ? Math.max(0, Math.min(MAX_BG_BLUR, Math.round(options.backgroundBlur)))
      : DEFAULT_BG_BLUR;
  await loadFontsForRendering();
  const canvas = document.createElement("canvas");
  canvas.width = PIN_WIDTH;
  canvas.height = PIN_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // 1. Background: image (cover) or solid brand color.
  ctx.fillStyle = brand.bg_color;
  ctx.fillRect(0, 0, PIN_WIDTH, PIN_HEIGHT);

  if (backgroundImageUrl) {
    try {
      const bg = await loadImage(canvasImageUrl(backgroundImageUrl));
      drawCover(ctx, bg, PIN_WIDTH, PIN_HEIGHT, blurPx);
    } catch {
      // Fall back to solid color if the image fails to load.
    }
  }

  // 2. Readability gradient overlay (softer/earlier for news, deeper for quotes).
  let topFade = 0.25;
  let bottomAlpha = 0.65;
  if (ct === "news") {
    topFade = 0.15;
    bottomAlpha = 0.8;
  } else if (ct === "fact") {
    topFade = 0.2;
    bottomAlpha = 0.72;
  }
  const grad = ctx.createLinearGradient(0, PIN_HEIGHT * topFade, 0, PIN_HEIGHT);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, `rgba(0,0,0,${bottomAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, PIN_WIDTH, PIN_HEIGHT);

  const pad = 80;
  const maxWidth = PIN_WIDTH - pad * 2;

  // Ensure real glyphs before any ctx.fillText (second gate for safety).
  await loadFontsForRendering();

  // 3. Content-type format rules:
  // - quote: centered, big quote marks, author "— Name" italic (if author set)
  // - news:  completely dedicated layout: top-right brand, NEWS chip,
  //          large left-aligned TITLE, multi-line DESCRIPTION below it;
  //          NO CTA; vertical space auto-distributed to avoid overlap.
  // - fact:  "Did you know?" badge, no author, centered bulleted / bold style
  const headBold = options.textStyle?.bold ?? true;
  const headItalic = options.textStyle?.italic ?? (ct === "quote");
  const brandNameColor = options.textStyle?.brandNameColor || brand.text_color;
  const headlineColor = options.textStyle?.headlineTextColor || brand.text_color;
  const textBgColor = options.textStyle?.textBgColor || null;
  const shadowOn = options.textStyle?.textShadowEnabled ?? true;
  const ctaTextColor = options.textStyle?.ctaTextColor || brand.bg_color;
  const ctaBgColor = options.textStyle?.ctaBgColor || brand.text_color;
  const ctaBold = options.textStyle?.ctaBold ?? false;
  const headStyle = headItalic ? "italic " : "";
  const headWeight = headBold ? "bold" : "normal";

  // ------------------------------------------------------------
  // NEWS: dispatch by template — magazine (default) / newspaper
  // Inputs used: branding (logo + name), image (bg), title, description,
  //              optional tiny "source = names......." at bottom.
  // NO CTA ever on news.
  // ------------------------------------------------------------
  if (ct === "news") {
    const tpl: NewsTemplate = options.newsTemplate ?? "magazine";
    const srcText = (meta.source || "").trim();

    if (tpl === "magazine") {
      // Magazine layout (reference image 1):
      //   Top-left: brand pill (logo + name on a colored bar + underline)
      //   Full image as background, gradient overlay getting dark at bottom
      //   NEWS chip badge
      //   Dashed-border card: BIG title (2-tone with one word highlight accent),
      //                         then 3-4 line description paragraph
      //   Bottom-left: tiny "Source: XYZ" credit
      const pad = 80;
      const maxWidth = PIN_WIDTH - pad * 2;

      // ======= Top-left brand pill =======
      let brandPillW = 0;
      let brandPillH = 0;
      const pillPadX = 28;
      const pillPadY = 14;
      const brandLogoPad = 20;
      let logoW = 0;
      let logoH = 0;
      let logoImg: HTMLImageElement | null = null;
      const brandLogoSource = brand.logo_url || brandIconUrl(brand.icon_name);
      if (brandLogoSource) {
        try {
          const lg = await loadImage(canvasImageUrl(brandLogoSource));
          const ratio = lg.width / lg.height;
          logoH = 72;
          logoW = Math.min(ratio * logoH, 260);
          if (logoW < 72) {
            logoW = 72;
            logoH = 72 / ratio;
          }
          logoImg = lg;
        } catch {
          // no logo
        }
      }
      {
        const brandTextSize = 34;
        ctx.font = `700 ${brandTextSize}px ${brand.font}`;
        const nameW = ctx.measureText(brand.name).width;
        brandPillW =
          (logoImg ? logoW + brandLogoPad : 0) + nameW + pillPadX * 2;
        brandPillH =
          Math.max(logoImg ? logoH : 0, brandTextSize) + pillPadY * 2;
      }
      const pillX = pad;
      const pillY = pad;
      // Background of the brand pill (ref image has deep green with thin yellow underline)
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(pillX, pillY, brandPillW, brandPillH, 14);
      } else {
        ctx.rect(pillX, pillY, brandPillW, brandPillH);
      }
      ctx.fillStyle = "#0B3328"; // deep forest brand bar
      ctx.fill();
      // Thin accent underline under the pill (like ref image's yellow line)
      ctx.fillStyle = brand.bg_color && brand.bg_color.toLowerCase() === "#ffffff"
        ? ctaBgColor
        : (options.textStyle?.ctaBgColor || "#E6C35C");
      ctx.fillRect(pillX + 10, pillY + brandPillH + 6, brandPillW - 20, 4);
      ctx.restore();
      // Draw logo + brand name inside pill
      {
        const cx = pillX + pillPadX;
        const cyMid = pillY + brandPillH / 2;
        if (logoImg) {
          const lx = cx;
          const ly = cyMid - logoH / 2;
          ctx.save();
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(lx, ly, logoW, logoH, 10);
          } else {
            ctx.rect(lx, ly, logoW, logoH);
          }
          ctx.clip();
          ctx.drawImage(logoImg, lx, ly, logoW, logoH);
          ctx.restore();
        }
        const brandTextSize = 34;
        ctx.font = `700 ${brandTextSize}px ${brand.font}`;
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const nameX = logoImg ? cx + logoW + brandLogoPad : cx;
        ctx.fillText(brand.name, nameX, cyMid + 2);
      }

      // ======= Reserve top padding: content starts below the pill + underline =======
      const contentAreaTop = pillY + brandPillH + 6 + 40;
      const contentAreaBottom = PIN_HEIGHT - 140;
      const contentAreaHeight = contentAreaBottom - contentAreaTop;

      // ======= 1. Measure NEWS chip =======
      const chipFontSize = 26;
      const chipPadX = 24;
      const chipPadY = 12;
      ctx.font = `800 ${chipFontSize}px ${brand.font}`;
      const chipText = "NEWS";
      const chipW = ctx.measureText(chipText).width + chipPadX * 2;
      const chipH = chipFontSize + chipPadY * 2;
      const chipGap = 30;

      // ======= 2. Fit TITLE into a big dashed card =======
      const titleText = (meta.image_title || meta.headline || meta.title || meta.main_line || "Breaking News").trim();
      const accentHue = options.textStyle?.ctaBgColor || brand.bg_color && brand.bg_color.toLowerCase() !== "#ffffff" ? brand.bg_color : "#F6D356";
      const titleWhite = "#FFFFFF";
      let titleFontSize = Math.min(
        90,
        Math.max(44, Math.floor(contentAreaHeight * 0.22))
      );
      let titleLines: string[] = [];
      let titleLineHeight = 0;
      const titleMaxLines = 5;
      while (titleFontSize >= 40) {
        ctx.font = `900 ${titleFontSize}px ${brand.font}`;
        titleLines = wrapText(ctx, titleText, maxWidth - 80); // subtract inner card padding
        if (titleLines.length <= titleMaxLines) break;
        titleFontSize -= 4;
      }
      if (titleFontSize < 40) titleFontSize = 40;
      ctx.font = `900 ${titleFontSize}px ${brand.font}`;
      titleLines = wrapText(ctx, titleText, maxWidth - 80);
      titleLineHeight = titleFontSize * 1.08;
      const titleBlockH = titleLines.length * titleLineHeight;

      // ======= 3. Fit DESCRIPTION =======
      const descText = (
        meta.image_description ||
        meta.description ||
        meta.main_line ||
        "More details coming soon."
      ).trim();
      const descMinLines = 3;
      const descMaxLines = 6;
      let descFontSize = 34;
      let descLines: string[] = [];
      let descLineHeight = 0;
      const usedSoFar = chipH + chipGap + titleBlockH + 50;
      const remainingMax = Math.max(
        150,
        contentAreaHeight - usedSoFar - (srcText ? 50 : 20)
      );
      while (descFontSize >= 22) {
        ctx.font = `400 ${descFontSize}px ${brand.font}`;
        descLines = wrapText(ctx, descText, maxWidth - 80);
        if (descLines.length >= descMinLines && descLines.length <= descMaxLines) {
          const probe = descLines.length * descFontSize * 1.4;
          if (probe <= remainingMax) break;
        }
        if (descLines.length < descMinLines) break;
        descFontSize -= 2;
      }
      if (descFontSize < 22) descFontSize = 22;
      ctx.font = `400 ${descFontSize}px ${brand.font}`;
      descLines = wrapText(ctx, descText, maxWidth - 80);
      if (descLines.length > descMaxLines) {
        const tail = descLines.slice(0, descMaxLines);
        const last = tail[descMaxLines - 1];
        if (last.length > 20) {
          tail[descMaxLines - 1] = `${last.slice(0, last.length - 3).trimEnd()}…`;
        }
        descLines = tail;
      }
      descLineHeight = descFontSize * 1.4;
      const descBlockH = descLines.length * descLineHeight;
      const titleDescGap = 34;

      // ======= Card sizing =======
      const cardInnerPadX = 42;
      const cardInnerPadTop = 40;
      const cardInnerPadBottom = 40;
      const cardW = maxWidth;
      const cardH =
        cardInnerPadTop +
        titleBlockH +
        titleDescGap +
        descBlockH +
        cardInnerPadBottom;

      const totalContentH = chipH + chipGap + cardH + (srcText ? 40 : 0);
      // Vertical start inside content area, centered
      let cursorY =
        contentAreaTop +
        Math.max(0, Math.floor((contentAreaHeight - totalContentH) / 2));

      // ======= NEWS chip (draws above the card, left-aligned with card) =======
      {
        const chipX = pad + 10;
        const chipY = cursorY;
        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(chipX, chipY, chipW, chipH, chipH / 2);
        } else {
          ctx.rect(chipX, chipY, chipW, chipH);
        }
        ctx.fillStyle = accentHue;
        ctx.fill();
        ctx.fillStyle = "#101828";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${chipFontSize}px ${brand.font}`;
        ctx.fillText(chipText, chipX + chipW / 2, chipY + chipH / 2 + 2);
        ctx.restore();
        cursorY += chipH + chipGap;
      }

      // ======= Dashed border card =======
      const cardX = pad;
      const cardY = cursorY;
      // Solid slightly-transparent dark fill first so legibility over background
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(cardX, cardY, cardW, cardH, 28);
      } else {
        ctx.rect(cardX, cardY, cardW, cardH);
      }
      ctx.fillStyle = "rgba(5, 15, 25, 0.62)";
      ctx.fill();
      // Dashed inner border
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.stroke();
      ctx.restore();

      // ======= TITLE lines (inside card, 2-tone accent on last 2 words per line) =======
      {
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        if (shadowOn) {
          ctx.shadowColor = "rgba(0,0,0,0.55)";
          ctx.shadowBlur = 10;
        }
        let ty = cardY + cardInnerPadTop + titleFontSize;
        for (let li = 0; li < titleLines.length; li++) {
          const line = titleLines[li];
          // Accent last N words (like the reference: "Habbey Teron" + "Assam Deputy Speaker" yellow)
          const words = line.split(/\s+/).filter(Boolean);
          const total = words.length;
          const accentFrom =
            total > 4 ? total - 2 : total > 2 ? total - 1 : total;
          // Find where to split: measure words left-to-right and break when we pass accentFrom.
          // Instead of that complex measurement, render word-by-word.
          const tx = cardX + cardInnerPadX;
          let cursorX = tx;
          ctx.font = `900 ${titleFontSize}px ${brand.font}`;
          for (let wi = 0; wi < words.length; wi++) {
            const word = words[wi];
            const accentWord = wi >= accentFrom;
            ctx.fillStyle = accentWord ? accentHue : titleWhite;
            const wordWithSpace = wi === 0 ? word : ` ${word}`;
            ctx.fillText(wordWithSpace, wi === 0 ? cursorX : cursorX, ty);
            cursorX += ctx.measureText(wordWithSpace).width;
          }
          ty += titleLineHeight;
        }
        ctx.shadowBlur = 0;
      }

      // ======= DESCRIPTION paragraph =======
      {
        const dx = cardX + cardInnerPadX;
        let dy =
          cardY + cardInnerPadTop + titleBlockH + titleDescGap + descFontSize;
        ctx.font = `400 ${descFontSize}px ${brand.font}`;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        if (shadowOn) {
          ctx.shadowColor = "rgba(0,0,0,0.55)";
          ctx.shadowBlur = 8;
        }
        for (const line of descLines) {
          ctx.fillText(line, dx, dy);
          dy += descLineHeight;
        }
        ctx.shadowBlur = 0;
      }

      // ======= Tiny source credit at very bottom of pin =======
      if (srcText) {
        const srcFontSize = 22;
        ctx.font = `500 ${srcFontSize}px ${brand.font}`;
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(srcText, pad, PIN_HEIGHT - 40);
      }
    } else {
      // ======= NEWSPAPER template (reference image 2) =======
      // Paper colour background. No image gradient overlay — instead the image
      // gets framed mid-canvas. Top: "BREAKING NEWS" serif mega-head, date +
      // brand website left/right, then giant headline (black serif, all-caps
      // style), thin divider, then framed image, and bottom tiny source.
      const paper = "#F3EBDD"; // warm off-white newsprint
      const ink = "#101010";
      const accent = brand.bg_color && brand.bg_color.toLowerCase() !== "#ffffff" ? brand.bg_color : "#9A2A1A";

      // 1. Fill paper (no image overlay gradient for paper). Image still
      // drawn framed so it stays visible. Background image ignored for paper
      // tint overlay because the reference uses clean paper look.
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, PIN_WIDTH, PIN_HEIGHT);

      const pad = 70;
      const contentW = PIN_WIDTH - pad * 2;

      // 2. Top brand row: double rule + BREAKING NEWS serif block + date/site.
      const ruleY = pad;
      ctx.save();
      // Rule 1
      ctx.fillStyle = ink;
      ctx.fillRect(pad, ruleY, contentW, 6);
      // Rule 2
      ctx.fillRect(pad, ruleY + 14, contentW, 2);
      ctx.restore();

      // 3. BREAKING NEWS (massive black serif — Playfair-like)
      const bannerFont = "'Playfair Display', 'Times New Roman', Georgia, serif";
      let bannerSize = 150;
      const bannerText = "BREAKING NEWS";
      while (bannerSize > 60) {
        ctx.font = `900 ${bannerSize}px ${bannerFont}`;
        const w = ctx.measureText(bannerText).width;
        if (w <= contentW) break;
        bannerSize -= 6;
      }
      if (bannerSize <= 60) bannerSize = 80;
      {
        const by = ruleY + 50;
        ctx.font = `900 ${bannerSize}px ${bannerFont}`;
        ctx.fillStyle = ink;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(bannerText, PIN_WIDTH / 2, by + bannerSize);
        // Rule under BREAKING NEWS block
        ctx.fillStyle = ink;
        const underY = by + bannerSize + 24;
        ctx.fillRect(pad, underY, contentW, 4);
        ctx.fillRect(pad, underY + 8, contentW, 2);
      }

      // 4. Date + website row (left: date, right: site/brand)
      const metaY = ruleY + 50 + bannerSize + 60;
      const metaFontSize = 30;
      ctx.font = `500 ${metaFontSize}px 'Playfair Display', Georgia, serif`;
      ctx.fillStyle = ink;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const today = new Date();
      const dateStr = today
        .toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase();
      ctx.fillText(dateStr, pad, metaY);
      // Right side: brand URL or brand name
      let brandRef = brand.name;
      // Try to pretty-print as a site if we can infer (no-op otherwise)
      ctx.textAlign = "right";
      ctx.fillText(brandRef.toUpperCase(), PIN_WIDTH - pad, metaY);
      // Thin divider under meta row
      ctx.fillStyle = ink;
      ctx.fillRect(pad, metaY + 16, contentW, 3);

      // 5. Giant headline (all caps serif, black, left-aligned, huge)
      const headlineAreaTop = metaY + 60;
      // Remaining space: headline + divider + framed image (and tiny source at bottom)
      const imageTargetH = 560;
      const dividerAfterHeadH = 4;
      const beforeImgGap = 40;
      const afterImgPad = 80 + (srcText ? 40 : 0);
      const headlineAreaBottom =
        PIN_HEIGHT -
        afterImgPad -
        beforeImgGap -
        dividerAfterHeadH -
        imageTargetH;
      const headlineMaxPx = Math.max(200, headlineAreaBottom - headlineAreaTop);
      const headlineText = (meta.headline || meta.image_title || meta.title || meta.main_line || "BREAKING").toUpperCase();
      let hSize = Math.min(110, Math.floor(headlineMaxPx / 4.5));
      let hLines: string[] = [];
      let hLineH = 0;
      const hMaxLines = 8;
      while (hSize >= 56) {
        ctx.font = `900 ${hSize}px ${bannerFont}`;
        hLines = wrapText(ctx, headlineText, contentW);
        if (hLines.length <= hMaxLines) {
          const probe = hLines.length * hSize * 1.05;
          if (probe <= headlineMaxPx) break;
        }
        hSize -= 4;
      }
      if (hSize < 56) hSize = 56;
      ctx.font = `900 ${hSize}px ${bannerFont}`;
      hLines = wrapText(ctx, headlineText, contentW);
      hLineH = hSize * 1.05;
      const hBlockH = hLines.length * hLineH;
      // Draw headline
      {
        let hy = headlineAreaTop + hSize;
        ctx.fillStyle = ink;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        for (const line of hLines) {
          ctx.fillText(line, pad, hy);
          hy += hLineH;
        }
      }

      // 6. Thin divider after the headline
      const dividerY = headlineAreaTop + hBlockH + beforeImgGap / 2;
      ctx.fillStyle = ink;
      ctx.fillRect(pad, dividerY, contentW, dividerAfterHeadH);

      // 7. Framed image (like the newspaper reference: thin black border around image)
      const frameY = dividerY + beforeImgGap / 2 + 24;
      const frameH = imageTargetH;
      const frameW = contentW;
      const frameBorder = 6;
      // Draw frame background first (for when there's no image, show solid)
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.lineWidth = frameBorder;
      ctx.strokeRect(pad, frameY, frameW, frameH);
      ctx.restore();
      if (backgroundImageUrl) {
        try {
          const bg = await loadImage(canvasImageUrl(backgroundImageUrl));
          const clipPad = frameBorder;
          ctx.save();
          // Clip inside the black frame border
          ctx.beginPath();
          ctx.rect(
            pad + clipPad,
            frameY + clipPad,
            frameW - clipPad * 2,
            frameH - clipPad * 2
          );
          ctx.clip();
          drawCover(
            ctx,
            bg,
            frameW - clipPad * 2,
            frameH - clipPad * 2,
            0
          );
          // drawCover draws at 0,0 — translate: re-draw via explicit drawImage
          // (drawCover operates on the whole canvas so we need to clip+translate).
          // Redraw explicitly to position correctly inside the clip:
          const clipW = frameW - clipPad * 2;
          const clipH = frameH - clipPad * 2;
          const scale = Math.max(clipW / bg.width, clipH / bg.height);
          const dw = bg.width * scale;
          const dh = bg.height * scale;
          const dx = pad + clipPad + (clipW - dw) / 2;
          const dy = frameY + clipPad + (clipH - dh) / 2;
          ctx.drawImage(bg, dx, dy, dw, dh);
          ctx.restore();
        } catch {
          // no image — frame falls back to paper colour with a lighter inner fill
          ctx.fillStyle = "#E9DFCA";
          ctx.fillRect(pad + frameBorder, frameY + frameBorder, frameW - frameBorder * 2, frameH - frameBorder * 2);
        }
      } else {
        ctx.fillStyle = "#E9DFCA";
        ctx.fillRect(pad + frameBorder, frameY + frameBorder, frameW - frameBorder * 2, frameH - frameBorder * 2);
      }

      // 8. Brand footer + source
      if (srcText) {
        const sfSize = 22;
        ctx.font = `500 ${sfSize}px 'Playfair Display', Georgia, serif`;
        ctx.fillStyle = "#404040";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(srcText, pad, PIN_HEIGHT - 40);
      }
      // Brand name at bottom right (newspaper footer credit)
      {
        const sfSize = 22;
        ctx.font = `italic 600 ${sfSize}px 'Playfair Display', Georgia, serif`;
        ctx.fillStyle = "#404040";
        ctx.textAlign = "right";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(brand.name, PIN_WIDTH - pad, PIN_HEIGHT - 40);
      }
    }
    // News template done — skip quote/fact section below
  } else {
    // ------------------------------------------------------------
    // Non-news (quote / fact) shared path — keeps original behaviour
    // ------------------------------------------------------------
    // Format-specific alignment + tag rules
    let textAlign: CanvasTextAlign = "center";
    let textAnchorX = PIN_WIDTH / 2;
    let tagLabel: string | null = null;
    let tagColor: string | null = null;
    if (ct === "fact") {
      tagLabel = "DID YOU KNOW";
      tagColor = brand.bg_color;
    }

    // Build main text. For quotes, prepend decorative curly quote character.
    let mainText = meta.main_line || meta.title;
    // Author only for quotes; everything else ignores author on the canvas.
    const authorText =
      ct === "quote" && author && author.trim() ? `— ${author.trim()}` : null;

    const headlineStart = ct === "quote" ? 88 : 72;
    const headlineMin = 40;
    const headlineMaxLines = 6;
    const { size, lines } = fitFont(
      ctx,
      mainText,
      brand.font,
      headWeight,
      maxWidth,
      headlineStart,
      headlineMin,
      headlineMaxLines,
      headStyle
    );
    const lineHeight = size * 1.2;
    const blockHeight = lines.length * lineHeight;
    const authorSize = authorText ? Math.max(30, Math.round(size * 0.42)) : 0;
    const tagSize = Math.max(24, Math.round(size * 0.28));
    const tagGap = tagLabel ? tagSize + 28 : 0;

    // Vertical anchor: quotes centered, facts middle-low.
    let y: number;
    if (ct === "quote") {
      y = (PIN_HEIGHT - blockHeight - tagGap - (authorSize ? authorSize + 20 : 0)) / 2 + size + tagGap;
    } else {
      // fact
      const ctaReserve = meta.cta ? 240 : 140;
      y = (PIN_HEIGHT - ctaReserve - blockHeight - tagGap) / 2 + size + tagGap;
    }

    // Optional solid backdrop behind the headline block.
    if (textBgColor) {
      ctx.font = `${headStyle}${headWeight} ${size}px ${brand.font}`;
      const maxLineW = Math.max(
        ...lines.map((l) => ctx.measureText(l).width),
        authorText ? ctx.measureText(authorText).width : 0,
        tagLabel ? ctx.measureText(tagLabel).width + 40 : 0
      );
      const padH = 44;
      const padV = 30;
      let boxLeft: number;
      if (textAlign === "center") {
        boxLeft = PIN_WIDTH / 2 - maxLineW / 2 - padH;
      } else {
        boxLeft = textAnchorX - padH;
      }
      const boxTop = y - size - padV - (tagLabel ? tagSize + 24 : 0);
      const lastBaseline = authorText
        ? y + blockHeight - lineHeight + authorSize * 0.6
        : y + (lines.length - 1) * lineHeight;
      const boxBottom = lastBaseline + size * 0.35 + padV;
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(boxLeft, boxTop, maxLineW + padH * 2, boxBottom - boxTop, 28);
      } else {
        ctx.rect(boxLeft, boxTop, maxLineW + padH * 2, boxBottom - boxTop);
      }
      ctx.fillStyle = textBgColor;
      ctx.fill();
      ctx.restore();
    }

    // Draw format tag chip (fact "DID YOU KNOW").
    if (tagLabel && tagColor) {
      ctx.font = `700 ${tagSize}px ${brand.font}`;
      const chipPadX = 22;
      const chipPadY = 14;
      const chipW = ctx.measureText(tagLabel).width + chipPadX * 2;
      const chipH = tagSize + chipPadY * 2;
      let chipX: number;
      if (textAlign === "center") {
        chipX = PIN_WIDTH / 2 - chipW / 2;
      } else {
        chipX = textAnchorX;
      }
      const chipY = y - size - chipH - 24;
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(chipX, chipY, chipW, chipH, chipH / 2);
      } else {
        ctx.rect(chipX, chipY, chipW, chipH);
      }
      ctx.fillStyle = tagColor;
      ctx.fill();
      ctx.fillStyle = ctaTextColor; // contrast against the brand color
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tagLabel, chipX + chipW / 2, chipY + chipH / 2 + 2);
      ctx.restore();
    }

    // Quote decorative glyph.
    if (ct === "quote") {
      ctx.save();
      ctx.font = `bold ${Math.round(size * 2.2)}px Georgia, serif`;
      ctx.fillStyle = `${headlineColor}33`; // 20% of headline color
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("\u201C", pad, y - 10);
      ctx.restore();
    }

    // Draw headline lines.
    ctx.font = `${headStyle}${headWeight} ${size}px ${brand.font}`;
    ctx.fillStyle = headlineColor;
    ctx.textAlign = textAlign;
    ctx.textBaseline = "alphabetic";
    if (shadowOn) {
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 12;
    }
    for (const line of lines) {
      ctx.fillText(line, textAnchorX, y);
      y += lineHeight;
    }
    ctx.shadowBlur = 0;

    // Author attribution (quotes only).
    if (authorText) {
      ctx.font = `italic 500 ${authorSize}px ${brand.font}`;
      ctx.fillStyle = headlineColor;
      ctx.textAlign = textAlign;
      if (shadowOn) {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 10;
      }
      ctx.fillText(authorText, textAnchorX, y + authorSize * 0.6);
      ctx.shadowBlur = 0;
    }

    // 4. CTA pill (quote + fact only; news has no CTA).
    if (meta.cta) {
      const ctaSize = 40;
      ctx.font = `${ctaBold ? "700" : "600"} ${ctaSize}px ${brand.font}`;
      const ctaW = ctx.measureText(meta.cta).width + 80;
      const ctaH = ctaSize + 44;
      const ctaX = (PIN_WIDTH - ctaW) / 2;
      const ctaY = PIN_HEIGHT - 160 - ctaH;
      ctx.beginPath();
      const r = ctaH / 2;
      ctx.moveTo(ctaX + r, ctaY);
      ctx.arcTo(ctaX + ctaW, ctaY, ctaX + ctaW, ctaY + ctaH, r);
      ctx.arcTo(ctaX + ctaW, ctaY + ctaH, ctaX, ctaY + ctaH, r);
      ctx.arcTo(ctaX, ctaY + ctaH, ctaX, ctaY, r);
      ctx.arcTo(ctaX, ctaY, ctaX + ctaW, ctaY, r);
      ctx.closePath();
      ctx.fillStyle = ctaBgColor;
      ctx.fill();
      ctx.fillStyle = ctaTextColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta.cta, ctaX + ctaW / 2, ctaY + ctaH / 2 + 2);
    }

    // 5. Logo + brand name at the top (quote/fact keep left side).
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const logoX = pad;
    let brandTextAnchor = pad;
    const brandLogoSource = brand.logo_url || brandIconUrl(brand.icon_name);
    if (brandLogoSource) {
      try {
        const logo = await loadImage(canvasImageUrl(brandLogoSource));
        const rawLw = (logo.width / logo.height) * 96;
        const fit = Math.min(1, 360 / rawLw);
        const lh = 96 * fit;
        const lw = rawLw * fit;
        const drawLx = logoX;
        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(drawLx, pad, lw, lh, 16);
        } else {
          ctx.rect(drawLx, pad, lw, lh);
        }
        ctx.clip();
        ctx.drawImage(logo, drawLx, pad, lw, lh);
        ctx.restore();
        brandTextAnchor = drawLx + lw + 24;
      } catch {
        // ignore
      }
    }
    ctx.fillStyle = brandNameColor;
    ctx.font = `${headStyle}${headBold ? "600" : "400"} 40px ${brand.font}`;
    if (shadowOn) {
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 8;
    }
    ctx.fillText(brand.name, brandTextAnchor, pad + 60);
    ctx.shadowBlur = 0;
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}
