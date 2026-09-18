"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { renderPin, DEFAULT_BG_BLUR, MAX_BG_BLUR, type PinTextStyle } from "@/lib/renderPin";
import BackgroundPicker from "./BackgroundPicker";
import { Icon } from "./Icon";
import { useDebouncedState } from "@/lib/useDebouncedState";
import {
  parsePastedList,
  parseImportCsv,
  downloadSampleCsv,
  columnsForMode,
  type SkippedRow,
} from "@/lib/csvImport";
import { parseImportJson, buildSampleJson } from "@/lib/jsonImport";
import {
  type Brand,
  type SavedBoard,
  type ContentType,
  type GeneratedMeta,
  type PinItem,
  type NewsTemplate,
  LANGUAGES,
  SITE_HOME_URL,
  FONTS,
} from "@/lib/types";
import PinPreview from "./PinPreview";

interface Props {
  brands: Brand[];
  boards?: SavedBoard[];
  initialCredits: number;
  initialAiCredits: number;
  initialLanguage: string;
  unlimited?: boolean;
  hasGeminiKey?: boolean;
  initialUseCustomKey?: boolean;
  userId?: string;
}

type InputMode = "topic" | "paste" | "csv" | "json";
// "with": AI generates missing details (AI + pin credits per pin).
// "without": rows must carry full details, no AI calls (pin credits only).
type AiMode = "with" | "without";
type Toast = { id: number; type: "error" | "success"; text: string };
interface PinFailure { index: number; message: string; }
// Frozen inputs for a run, so "retry failed" re-runs the same rows even if
// the user edits the form afterwards. Look/style settings (brand, bg pool,
// blur, text style, links) stay live on purpose — tweaking those before a
// retry is a feature.
interface RunSnapshot {
  items: PinItem[];
  contentType: ContentType;
  inputMode: InputMode;
  aiMode: AiMode;
  language: string;
  newsTemplate: NewsTemplate;
}
interface RunReport {
  batchId: string;
  succeeded: number;
  attempted: number;
  failures: PinFailure[];
  cancelled: boolean;
  snapshot: RunSnapshot;
}

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset() + 120);
  return d.toISOString().slice(0, 16);
}

const isUrl = (v: string) => /^https?:\/\/.+/i.test(v.trim());

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Thrown when the user cancels mid-run. It must propagate through
// generateMeta/processPin (not be recorded as a pin failure).
class CancelledError extends Error {}

// Wrap quote text in double quotes ("...") unless it is already quoted
// (straight, curly, or single). Quotes render on the pin by default.
function withQuoteMarks(text: string): string {
  const t = text.trim();
  if (t.length === 0) return t;
  const openers = ['"', "\u201C", "\u2018", "'"];
  const closers = ['"', "\u201D", "\u2019", "'"];
  if (openers.includes(t[0]) && closers.includes(t[t.length - 1])) return t;
  return `"${t}"`;
}

// Gemini free-tier signals: HTTP 429 / RESOURCE_EXHAUSTED / quota messages.
function isRateLimitMessage(message: string): boolean {
  return /429|RESOURCE_EXHAUSTED|quota exceeded|rate[\s-]?limit|please retry in [\d.]+s|model is overloaded|overloaded| 503/i.test(
    message
  );
}

// Gemini hints like "Please retry in 38.79s" or "retryDelay": "38s".
function parseRetryDelayMs(message: string): number | null {
  const m =
    message.match(/retry in ([\d.]+)s/i) ||
    message.match(/retryDelay["']?\s*:\s*["']?([\d.]+)s/i);
  if (!m) return null;
  const ms = Math.ceil(parseFloat(m[1]) * 1000);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

// Retries for throttled Gemini calls; pacing between request starts so
// parallel workers don't burst the per-minute limit.
const META_MAX_ATTEMPTS = 5;
const META_MIN_GAP_MS = 2000;
const META_BACKOFF_BASE_MS = 5000;
const META_BACKOFF_MAX_MS = 60000;

export default function BatchForm({
  brands,
  boards = [],
  initialCredits,
  initialAiCredits,
  initialLanguage,
  unlimited = false,
  hasGeminiKey = false,
  initialUseCustomKey = true,
  userId,
}: Props) {
  const router = useRouter();
  const [useCustomKey, setUseCustomKey] = useState(initialUseCustomKey);
  const [toggleBusy, setToggleBusy] = useState(false);
  const effectiveUnlimited = hasGeminiKey && useCustomKey;

  const [brandId, setBrandId] = useState(brands[0].id);
  const [boardName, setBoardName] = useState("");
  const [boardsList, setBoardsList] = useState<SavedBoard[]>(boards ?? []);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [savingBoard, setSavingBoard] = useState(false);
  const [contentType, setContentType] = useState<ContentType>("quote");
  const [newsTemplate, setNewsTemplate] = useState<NewsTemplate>("magazine");
  const [sourceLink, setSourceLink] = useState(SITE_HOME_URL);
  const [language, setLanguage] = useState(initialLanguage);

  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [aiMode, setAiMode] = useState<AiMode>("with");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(20);
  const [pasteList, setPasteList] = useState("");
  // Raw CSV sources (re-parsed when type/mode changes so validation matches).
  const [csvSources, setCsvSources] = useState<{ name: string; text: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [copiedSample, setCopiedSample] = useState(false);
  const [ctaOverride, setCtaOverride] = useState("");

  const [bgPool, setBgPool] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bgBlurEnabled, setBgBlurEnabled] = useState(true);
  const [bgBlurPx, setBgBlurPx] = useState(DEFAULT_BG_BLUR);

  const [start, setStart] = useState(defaultStart());
  const [intervalMin, setIntervalMin] = useState(60);
  const [concurrency, setConcurrency] = useState(4);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [generationStage, setGenerationStage] = useState("Preparing your batch…");
  const [credits, setCredits] = useState(initialCredits);
  const [aiCredits, setAiCredits] = useState(initialAiCredits);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [runReport, setRunReport] = useState<RunReport | null>(null);
  const [quotaModal, setQuotaModal] = useState<{ batchId: string } | null>(null);
  // Shown when With-AI is chosen but no custom Gemini key exists (AI is BYOK-only).
  const [apiKeyPromptOpen, setApiKeyPromptOpen] = useState(false);
  // Set by the Cancel button; workers finish their current pin and stop.
  const cancelRef = useRef(false);
  // Set when a pin terminally fails with a rate-limit error on shared keys.
  const quotaHitRef = useRef(false);
  // Shared across parallel workers: spaces out Gemini request starts.
  const metaPaceRef = useRef({ lastStart: 0 });

  async function toggleUseCustomKey(next: boolean) {
    if (!userId) return;
    setToggleBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ use_custom_gemini_key: next })
      .eq("id", userId);
    setToggleBusy(false);
    if (error) {
      console.error(error);
      return;
    }
    setUseCustomKey(next);
  }

  const brand = useMemo(
    () => brands.find((b) => b.id === brandId)!,
    [brands, brandId]
  );

  const [fontOverride, setFontOverride] = useState<string | undefined>(undefined);
  const [textColorImm, textColorDeb, setTextColor] = useDebouncedState<string | null>(null, 120);
  const [bgColorImm, bgColorDeb, setBgColor] = useDebouncedState<string | null>(null, 120);

  async function saveCurrentBoard() {
    const trimmed = boardName.trim();
    if (!trimmed || !userId) return;
    if (boardsList.some((b) => b.name === trimmed)) {
      pushToast("error", `Board "${trimmed}" is already saved.`);
      return;
    }
    setSavingBoard(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("saved_boards")
      .insert({ user_id: userId, name: trimmed })
      .select()
      .single();
    setSavingBoard(false);
    if (error) {
      pushToast("error", error.message);
      return;
    }
    setBoardsList((prev) => [data, ...prev]);
    setSelectedBoardId(data.id);
    pushToast("success", `Board "${trimmed}" saved and ready to reuse.`);
  }

  function onPickSavedBoard(id: string) {
    setSelectedBoardId(id);
    const found = boardsList.find((b) => b.id === id);
    if (found) setBoardName(found.name);
  }

  const effectiveBrand = useMemo(
    () => ({
      ...brand,
      ...(fontOverride ? { font: fontOverride } : {}),
      ...(textColorDeb ? { text_color: textColorDeb } : {}),
      ...(bgColorDeb ? { bg_color: bgColorDeb } : {}),
    }),
    [brand, fontOverride, textColorDeb, bgColorDeb]
  );

  // Background blur for this batch only (0 = off). Preview + generated pins share it.
  const effectiveBlur = bgBlurEnabled ? bgBlurPx : 0;

  // Batch-only text styling (no DB changes — saved brand untouched).
  const [brandNameColorImm, brandNameColorDeb, setBrandNameColor] = useDebouncedState<string | null>(null, 120);
  const [headlineTextColorImm, headlineTextColorDeb, setHeadlineTextColor] = useDebouncedState<string | null>(null, 120);
  const [textBold, setTextBold] = useState(true);
  const [textItalic, setTextItalic] = useState(false);
  const [textBgEnabled, setTextBgEnabled] = useState(false);
  const [textBgColorImm, textBgColorDeb, setTextBgColor] = useDebouncedState("#000000", 120);
  const [textShadowEnabled, setTextShadowEnabled] = useState(true);
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaTextColorImm, ctaTextColorDeb, setCtaTextColor] = useDebouncedState("#ffffff", 120);
  const [ctaBgColorImm, ctaBgColorDeb, setCtaBgColor] = useDebouncedState<string>(brand.text_color, 120);
  const [ctaBold, setCtaBold] = useState(false);

  useEffect(() => {
    setCtaBgColor(brand.text_color);
  }, [brand.text_color, setCtaBgColor]);

  const textStyle: PinTextStyle = useMemo(
    () => ({
      brandNameColor: brandNameColorDeb ?? effectiveBrand.text_color,
      headlineTextColor: headlineTextColorDeb ?? effectiveBrand.text_color,
      bold: textBold,
      italic: textItalic,
      textBgColor: textBgEnabled ? textBgColorDeb : null,
      textShadowEnabled,
      ctaTextColor: ctaEnabled ? ctaTextColorDeb : undefined,
      ctaBgColor: ctaEnabled ? ctaBgColorDeb : undefined,
      ctaBold: ctaEnabled ? ctaBold : undefined,
    }),
    [
      brandNameColorDeb,
      headlineTextColorDeb,
      effectiveBrand.text_color,
      textBold,
      textItalic,
      textBgEnabled,
      textBgColorDeb,
      textShadowEnabled,
      ctaEnabled,
      ctaTextColorDeb,
      ctaBgColorDeb,
      ctaBold,
    ]
  );
  const textStyleCustomized =
    brandNameColorImm !== null ||
    headlineTextColorImm !== null ||
    !textBold ||
    textItalic ||
    textBgEnabled ||
    !textShadowEnabled ||
    ctaEnabled;
  const anyBrandOverride = fontOverride !== undefined || textColorImm !== null || bgColorImm !== null;

  const resetBrandBar = useCallback(() => {
    setFontOverride(undefined);
    setTextColor(null);
    setBgColor(null);
    setBrandNameColor(null);
  }, [setBrandNameColor, setBgColor, setTextColor]);

  const resetHeadline = useCallback(() => {
    setHeadlineTextColor(null);
    setTextBold(true);
    setTextItalic(false);
    setTextBgEnabled(false);
    setTextBgColor("#000000");
    setTextShadowEnabled(true);
  }, [setHeadlineTextColor, setTextBgColor]);

  const resetCta = useCallback(() => {
    setCtaEnabled(false);
    setCtaTextColor("#ffffff");
    setCtaBgColor(brand.text_color);
    setCtaBold(false);
  }, [brand.text_color, setCtaBgColor, setCtaTextColor]);

  const resetTextStyle = useCallback(() => {
    resetBrandBar();
    resetHeadline();
    resetCta();
  }, [resetBrandBar, resetHeadline, resetCta]);

  useEffect(() => {
    resetTextStyle();
  }, [brandId, resetTextStyle]);

  // Quotes default their destination to the main site; other types start empty.
  useEffect(() => {
    if (contentType === "quote") {
      setSourceLink((s) => (s.trim() === "" ? SITE_HOME_URL : s));
    }
  }, [contentType]);

  function pushToast(type: Toast["type"], text: string) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }

  // Sleep that aborts early when the user cancels generation.
  async function cancellableSleep(ms: number): Promise<void> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (cancelRef.current) throw new CancelledError("cancelled");
      await sleep(Math.min(1000, end - Date.now()));
    }
  }

  const requireFullDetails = aiMode === "without";

  const jsonParsed = useMemo(
    () => parseImportJson(jsonText, contentType, { requireFullDetails }),
    [jsonText, contentType, requireFullDetails]
  );

  // Merged multi-file CSV parse (re-derived when type/mode changes).
  // Skipped row numbers are offset per file: 1 header + data rows each.
  const csvParsed = useMemo(() => {
    const allItems: PinItem[] = [];
    const allSkipped: SkippedRow[] = [];
    let rowOffset = 0;
    for (const src of csvSources) {
      const { items: parsed, skipped } = parseImportCsv(src.text, contentType, {
        requireFullDetails,
      });
      allItems.push(...parsed);
      const prefix = csvSources.length > 1 ? `${src.name}: ` : "";
      for (const s of skipped) {
        allSkipped.push({ row: s.row + rowOffset, reason: `${prefix}${s.reason}` });
      }
      rowOffset += 1 + parsed.length + skipped.length;
    }
    return { items: allItems, skipped: allSkipped };
  }, [csvSources, contentType, requireFullDetails]);

  const csvName =
    csvSources.length === 0
      ? null
      : csvSources.length === 1
        ? csvSources[0].name
        : `${csvSources[0].name} + ${csvSources.length - 1} more`;

  const items: PinItem[] = useMemo(() => {
    if (inputMode === "topic") {
      if (!topic.trim()) return [];
      return Array.from(
        { length: count },
        (_, i) =>
          ({
            text: `${topic.trim()} (idea ${i + 1} of ${count} — make it distinct and non-repeating)`,
          } as PinItem)
      );
    }
    if (inputMode === "paste") return parsePastedList(pasteList, contentType);
    if (inputMode === "json") return jsonParsed.items;
    return csvParsed.items;
  }, [inputMode, topic, count, pasteList, contentType, csvParsed, jsonParsed]);

  function effectiveBg(index: number, item: PinItem): string | null {
    if (item.bgUrl) return item.bgUrl;
    if (bgPool.length === 0) return null;
    return bgPool[index % bgPool.length];
  }

  async function onCsvFile(file: File) {
    const text = await file.text();
    setCsvSources([{ name: file.name, text }]);
  }

  async function onJsonFile(file: File) {
    const text = await file.text();
    setJsonText(text);
    const { items: parsed, error } = parseImportJson(text, contentType, {
      requireFullDetails,
    });
    if (error) {
      pushToast("error", error);
    } else if (parsed.length === 0) {
      pushToast("error", "No valid rows found in that JSON.");
    }
  }

  async function copySampleJson() {
    const sample = buildSampleJson(contentType, aiMode === "without");
    try {
      await navigator.clipboard.writeText(sample);
    } catch {
      // Clipboard API unavailable (permissions/iframe) — legacy fallback.
      const ta = document.createElement("textarea");
      ta.value = sample;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  }

  async function handleCsvDrop(fileList: FileList) {
    const files = Array.from(fileList);
    const csvFiles = files.filter(
      (f) => f.name.toLowerCase().endsWith(".csv") || f.type === "text/csv"
    );
    const nonCsvCount = files.length - csvFiles.length;
    if (nonCsvCount > 0) {
      pushToast(
        "error",
        `Dropped ${nonCsvCount} non-CSV file${nonCsvCount === 1 ? "" : "s"}. Only .csv files are accepted.`
      );
    }
    if (csvFiles.length === 0) return;

    const sources: { name: string; text: string }[] = [];
    for (const file of csvFiles) {
      sources.push({ name: file.name, text: await file.text() });
    }
    setCsvSources(sources);
  }

  function switchAiMode(m: AiMode) {
    // With-AI is BYOK-only (no built-in AI on the site). Gate it behind a key.
    if (m === "with" && !hasGeminiKey) {
      setAiMode(m);
      if (inputMode === "json") {
        setInputMode("paste");
      }
      setApiKeyPromptOpen(true);
      return;
    }
    setAiMode(m);
    // JSON exists only without AI; paste/topic exist only with AI.
    if (m === "without" && (inputMode === "paste" || inputMode === "topic")) {
      setInputMode("csv");
    }
    if (m === "with" && inputMode === "json") {
      setInputMode("paste");
    }
  }

  function composeInput(item: PinItem, ct: ContentType): string {
    if (ct === "quote" && item.author) {
      return `"${item.text}" — ${item.author}`;
    }
    return item.text;
  }

  async function generateMeta(input: string, lang: string, ct: ContentType): Promise<GeneratedMeta> {
    // Pace request starts so parallel workers don't burst the rate limit.
    // The check + timestamp update run synchronously per worker turn, so
    // concurrent workers still observe each other's reservations.
    for (;;) {
      const wait = metaPaceRef.current.lastStart + META_MIN_GAP_MS - Date.now();
      if (wait <= 0) break;
      await cancellableSleep(wait);
    }
    metaPaceRef.current.lastStart = Date.now();

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= META_MAX_ATTEMPTS; attempt++) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.functions.invoke("generate-meta", {
          body: { content_type: ct, language: lang, input },
        });
        if (error) {
          let detail = "";
          const response = (error as { context?: Response }).context;
          if (response) {
            try {
              const body = await response.clone().json();
              detail = body?.error ? `: ${body.error}` : "";
            } catch {
              // Keep the original Supabase error when the response is not JSON.
            }
          }
          throw new Error(`${error.message}${detail}`);
        }
        if (data?.error) throw new Error(data.error);
        return data as GeneratedMeta;
      } catch (err) {
        if (err instanceof CancelledError) throw err;
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        if (!isRateLimitMessage(message)) throw err;
        if (attempt === META_MAX_ATTEMPTS) {
          throw new Error(
            `${message} — Gemini quota is exhausted. The free tier is limited ` +
              `(about 20 requests/day for this model). Add your own Gemini API key ` +
              `in Settings for unlimited generation, or try again later.`
          );
        }
        const hinted = parseRetryDelayMs(message);
        const backoff =
          hinted ??
          Math.min(META_BACKOFF_MAX_MS, META_BACKOFF_BASE_MS * 2 ** (attempt - 1));
        const waitMs = backoff + Math.floor(Math.random() * 2000);
        setGenerationStage(
          `Gemini rate limit hit — retrying in ${Math.ceil(waitMs / 1000)}s (attempt ${attempt + 1}/${META_MAX_ATTEMPTS})…`
        );
        await cancellableSleep(waitMs);
      }
    }
    throw lastError;
  }

  function requestGenerate() {
    if (!boardName.trim()) return pushToast("error", "Board name is required.");
    if (!isUrl(sourceLink))
      return pushToast("error", "Source link must be a valid http(s) URL.");
    if (items.length === 0)
      return pushToast("error", "Add at least one valid item.");
    if (aiMode === "with" && !hasGeminiKey) {
      setApiKeyPromptOpen(true);
      return;
    }
    if (!effectiveUnlimited && credits < items.length)
      return pushToast(
        "error",
        `Not enough pin credits. You need ${items.length}, but have ${credits}.`
      );
    if (!effectiveUnlimited && aiMode === "with" && aiCredits < items.length)
      return pushToast(
        "error",
        `Not enough AI credits. You need ${items.length}, but have ${aiCredits}. Switch to Without-AI mode or add your own Gemini key in Settings.`
      );
    setConfirmOpen(true);
  }

  interface ExecuteCtx {
    supabase: ReturnType<typeof createClient>;
    userId: string;
    batchId: string;
    startMs: number;
    progressTotal: number;
    pinSnapshot: number;
    aiSnapshot: number;
    run: RunSnapshot;
  }

  // Single profiles UPDATE for one execution pass: every success spends 1 pin
  // credit; successes that called the AI additionally spend 1 AI credit.
  // Falls back to the legacy single pool when the ai_credits column is
  // missing (migration not run yet) instead of failing the sync.
  async function spendCredits(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    pinSnapshot: number,
    aiSnapshot: number,
    successes: number,
    aiUsed: number
  ): Promise<void> {
    if (effectiveUnlimited || successes === 0) return;
    const finalPins = pinSnapshot - successes;
    const finalAi = aiSnapshot - aiUsed;
    const { error: credErr } = await supabase
      .from("profiles")
      .update({ credits: finalPins, ai_credits: finalAi })
      .eq("id", userId);
    if (!credErr) {
      setCredits(finalPins);
      setAiCredits(finalAi);
      return;
    }
    const singleFinal = pinSnapshot - successes;
    const { error: fbErr } = await supabase
      .from("profiles")
      .update({ credits: singleFinal })
      .eq("id", userId);
    if (!fbErr) {
      setCredits(singleFinal);
      setAiCredits(singleFinal);
      return;
    }
    pushToast("error", `Credits sync failed: ${fbErr.message}`);
  }

  // Runs one pass over the given item indices with bounded parallelism.
  // Returns successes + per-pin failures (cancelled pins are neither).
  async function executeIndices(
    indices: number[],
    ctx: ExecuteCtx
  ): Promise<{ successCount: number; aiUsedCount: number; failures: PinFailure[]; cancelled: boolean }> {
    const { supabase, userId, batchId, startMs, progressTotal, pinSnapshot, aiSnapshot, run } = ctx;
    setProgress({ done: 0, total: progressTotal });
    const remainingPinRef = { v: pinSnapshot };
    const remainingAiRef = { v: aiSnapshot };
    const failures: PinFailure[] = [];
    let successCount = 0;
    let aiUsedCount = 0;
    const poolSize = Math.max(1, Math.min(concurrency, indices.length));
    let cursor = 0;

    function markDone() {
      setProgress((p) => ({ done: p.done + 1, total: progressTotal }));
    }

    async function processPin(i: number): Promise<void> {
      const item = run.items[i];
      // Without-AI mode never touches Gemini; With-AI always does.
      const useAi = run.aiMode === "with";
      if (cancelRef.current) {
        markDone();
        return;
      }
      // Early abort when either pool is exhausted (shared lock-less counters;
      // each pin only subtracts 1 via Math.max-safe decrements on success).
      if (!effectiveUnlimited && remainingPinRef.v <= 0) {
        const message = "pin credits exhausted";
        failures.push({ index: i, message });
        pushToast("error", `Pin ${i + 1} skipped: ${message}.`);
        markDone();
        return;
      }
      if (!effectiveUnlimited && useAi && remainingAiRef.v <= 0) {
        const message = "AI credits exhausted";
        failures.push({ index: i, message });
        pushToast("error", `Pin ${i + 1} skipped: ${message}.`);
        markDone();
        return;
      }
      try {
        // Per-row details: any field left empty falls back to AI ("default").
        const custom = {
          title: item.title?.trim() || "",
          description: item.description?.trim() || "",
          imageTitle: item.imageTitle?.trim() || "",
          imageDescription: item.imageDescription?.trim() || "",
          headline: item.headline?.trim() || "",
          tags: (item.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 20),
          cta: (item.cta?.trim() || "").slice(0, 80),
          mainLine: (item.mainLine?.trim() || "").slice(0, 300),
          source: (item.source?.trim() || "").slice(0, 120),
        };

        let meta: GeneratedMeta;
        let didAi = false;
        if (!useAi) {
          // Rows are guaranteed complete by the importer — no AI call.
          setGenerationStage(`Using your details for pin ${i + 1} of ${progressTotal}…`);
          meta = {
            title: custom.title,
            description: custom.description,
            tags: custom.tags,
            main_line:
              run.contentType === "quote" ? withQuoteMarks(item.text) : custom.mainLine,
            cta: custom.cta,
            source: custom.source,
            ...(run.contentType === "news"
              ? {
                  image_title: custom.imageTitle,
                  image_description: custom.imageDescription,
                  headline: custom.headline,
                }
              : {}),
          };
        } else {
          setGenerationStage(`Writing metadata for pin ${i + 1} of ${progressTotal}…`);
          meta = await generateMeta(composeInput(item, run.contentType), run.language, run.contentType);
          didAi = true;
          if (custom.title) meta.title = custom.title.slice(0, 100);
          if (custom.description) meta.description = custom.description.slice(0, 500);
          if (run.contentType === "news") {
            if (custom.imageTitle) meta.image_title = custom.imageTitle.slice(0, 100);
            if (custom.imageDescription) meta.image_description = custom.imageDescription.slice(0, 500);
            if (custom.headline) meta.headline = custom.headline.slice(0, 300);
          }
          if (custom.tags.length > 0) meta.tags = custom.tags;
          if (custom.cta) meta.cta = custom.cta;
          if (custom.source) meta.source = custom.source;
          if (run.contentType === "news") {
            meta.image_title = custom.imageTitle || meta.image_title || meta.title;
            meta.image_description =
              custom.imageDescription || meta.image_description || meta.description;
            meta.headline = custom.headline || meta.headline || item.text;
          }
        }
        if (cancelRef.current) {
          markDone();
          return;
        }
        // For quotes, render the actual quote text (not an AI paraphrase),
        // wrapped in double quotes by default. In topic mode the item text
        // is a generation prompt, not a quote — keep the AI's distinct line.
        if (run.contentType === "quote" && run.inputMode !== "topic") {
          meta.main_line = withQuoteMarks(item.text);
        } else if (custom.mainLine && run.contentType !== "quote") {
          meta.main_line = custom.mainLine;
        }
        // Optional batch-wide CTA override (same text on every pin).
        const customCta = run.contentType === "news" ? "" : ctaOverride.trim().slice(0, 80);
        if (customCta) meta.cta = customCta;
        if (run.contentType === "news") meta.cta = "";

        setGenerationStage(`Rendering pin ${i + 1} of ${progressTotal}…`);
        const blob = await renderPin({
          brand: effectiveBrand,
          meta,
          contentType: run.contentType,
          newsTemplate: run.contentType === "news" ? run.newsTemplate : undefined,
          backgroundImageUrl: effectiveBg(i, item),
          backgroundBlur: effectiveBlur,
          textStyle,
          author: contentType === "quote" ? item.author ?? null : null,
        });

        setGenerationStage(`Uploading pin ${i + 1} of ${progressTotal}…`);
        const path = `${userId}/${batchId}-${i}.png`;
        // upsert: retries of the same index overwrite instead of failing.
        const { error: upErr } = await supabase.storage
          .from("rendered-pins")
          .upload(path, blob, { contentType: "image/png", upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage
          .from("rendered-pins")
          .getPublicUrl(path);

        // Deterministic schedule spacing from the item index (not pool order).
        const scheduledAt = new Date(
          startMs + i * intervalMin * 60_000
        ).toISOString();

        const safeTags = Array.isArray(meta.tags)
          ? meta.tags
              .map((t) => (typeof t === "string" ? t.trim() : ""))
              .filter((t) => t.length > 0)
              .slice(0, 20)
          : [];
        const safeTitle = (meta.title || "Untitled Pin")
          .trim()
          .slice(0, 100);
        const safeDescription = (meta.description || "")
          .trim()
          .slice(0, 500);
        const safeMainLine = (meta.main_line || "").slice(0, 300);
        const safeCta = (meta.cta || "").slice(0, 80);
        const safeSourceLink =
          item.link && item.link.trim().length > 0
            ? item.link.trim()
            : sourceLink.trim() || null;

        setGenerationStage(`Saving pin ${i + 1} of ${progressTotal}…`);
        const { error: pinErr } = await supabase.from("pins").insert({
          user_id: userId,
          batch_id: batchId,
          title: safeTitle,
          description: safeDescription,
          tags: safeTags,
          main_line: safeMainLine,
          cta: safeCta,
          image_url: urlData.publicUrl,
          source_link: safeSourceLink,
          scheduled_at: scheduledAt,
        });
        if (pinErr) throw pinErr;

        if (!effectiveUnlimited) {
          remainingPinRef.v = Math.max(0, remainingPinRef.v - 1);
          if (didAi) remainingAiRef.v = Math.max(0, remainingAiRef.v - 1);
        }
        successCount += 1;
        if (didAi) aiUsedCount += 1;
      } catch (err) {
        if (err instanceof CancelledError) {
          markDone();
          return;
        }
        const message = (err as Error).message;
        failures.push({ index: i, message });
        // Shared-key quota exhaustion: stop the bleeding — remaining pins
        // would fail the same way. The run ends with an API-key prompt.
        if (!effectiveUnlimited && isRateLimitMessage(message)) {
          quotaHitRef.current = true;
          cancelRef.current = true;
        }
        pushToast("error", `Pin ${i + 1} failed: ${message}`);
      }
      // Atomic progress increment — React batching is fine.
      markDone();
    }

    // Bounded-parallel worker pool: at most `poolSize` in-flight pins.
    async function worker(): Promise<void> {
      for (;;) {
        if (cancelRef.current) return;
        const k = cursor;
        cursor += 1;
        if (k >= indices.length) return;
        await processPin(indices[k]);
      }
    }
    await Promise.all(
      Array.from({ length: poolSize }, () => worker())
    );

    return { successCount, aiUsedCount, failures, cancelled: cancelRef.current };
  }

  async function runGenerate() {
    setConfirmOpen(false);
    setRunReport(null);
    setQuotaModal(null);
    cancelRef.current = false;
    quotaHitRef.current = false;
    setGenerating(true);
    setGenerationStage("Preparing your batch…");
    console.time("batch");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setGenerating(false);
      console.timeEnd("batch");
      return pushToast("error", "Not authenticated.");
    }

    const total = items.length;
    const { data: batch, error: batchErr } = await supabase
      .from("batches")
      .insert({
        user_id: user.id,
        brand_id: brandId,
        board_name: boardName.trim(),
        source_link: sourceLink.trim(),
        content_type: contentType,
        language,
      })
      .select()
      .single();
    if (batchErr || !batch) {
      setGenerating(false);
      console.timeEnd("batch");
      return pushToast("error", batchErr?.message ?? "Failed to create batch.");
    }

    const userId = user.id;
    const batchId = batch.id;
    const pinSnapshot = credits;
    const aiSnapshot = aiCredits;
    const startMs = new Date(start).getTime();
    const run: RunSnapshot = { items, contentType, inputMode, aiMode, language, newsTemplate };

    const outcome = await executeIndices(
      items.map((_, i) => i),
      { supabase, userId, batchId, startMs, progressTotal: total, pinSnapshot, aiSnapshot, run }
    );

    // Single profiles UPDATE at the end (cuts N-1 round-trips).
    await spendCredits(supabase, userId, pinSnapshot, aiSnapshot, outcome.successCount, outcome.aiUsedCount);

    console.timeEnd("batch");
    setGenerating(false);
    if (outcome.failures.length === 0 && !outcome.cancelled) {
      pushToast("success", `Generated ${outcome.successCount} of ${total} pins.`);
      router.push(`/dashboard/batches/${batchId}`);
      router.refresh();
      return;
    }
    // Partial result: stay on the page with a report so failures can be retried.
    setRunReport({
      batchId,
      succeeded: outcome.successCount,
      attempted: total,
      failures: outcome.failures,
      cancelled: outcome.cancelled,
      snapshot: run,
    });
    if (quotaHitRef.current && !effectiveUnlimited) {
      setQuotaModal({ batchId });
    }
    pushToast(
      outcome.cancelled ? "error" : "success",
      outcome.cancelled
        ? `Cancelled — kept ${outcome.successCount} of ${total} pins.`
        : `Generated ${outcome.successCount} of ${total} pins (${outcome.failures.length} failed).`
    );
  }

  // Re-runs only the failed indices of the last report, into the same batch.
  // Uses the report's frozen input snapshot, so form edits made afterwards
  // can't shift the retry onto the wrong rows.
  async function runRetry() {
    if (!runReport || generating) return;
    const failedIdx = runReport.failures.map((f) => f.index);
    if (failedIdx.length === 0) return;
    const run = runReport.snapshot;
    const retryAiNeed = run.aiMode === "with" ? failedIdx.length : 0;
    if (!effectiveUnlimited && credits < failedIdx.length) {
      return pushToast(
        "error",
        `Not enough pin credits. You need ${failedIdx.length}, but have ${credits}.`
      );
    }
    if (!effectiveUnlimited && retryAiNeed > 0 && aiCredits < retryAiNeed) {
      return pushToast(
        "error",
        `Not enough AI credits. You need ${retryAiNeed}, but have ${aiCredits}.`
      );
    }
    setQuotaModal(null);
    cancelRef.current = false;
    quotaHitRef.current = false;
    setGenerating(true);
    setGenerationStage("Retrying failed pins…");
    console.time("batch-retry");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setGenerating(false);
      console.timeEnd("batch-retry");
      return pushToast("error", "Not authenticated.");
    }
    const batchId = runReport.batchId;
    const prevSucceeded = runReport.succeeded;
    const attempted = runReport.attempted;
    const pinSnapshot = credits;
    const aiSnapshot = aiCredits;
    const startMs = new Date(start).getTime();

    const outcome = await executeIndices(failedIdx, {
      supabase,
      userId: user.id,
      batchId,
      startMs,
      progressTotal: failedIdx.length,
      pinSnapshot,
      aiSnapshot,
      run,
    });

    await spendCredits(supabase, user.id, pinSnapshot, aiSnapshot, outcome.successCount, outcome.aiUsedCount);

    console.timeEnd("batch-retry");
    setGenerating(false);
    const totalSucceeded = prevSucceeded + outcome.successCount;
    if (outcome.failures.length === 0 && !outcome.cancelled) {
      pushToast("success", `All recovered — ${totalSucceeded} of ${attempted} pins ready.`);
      router.push(`/dashboard/batches/${batchId}`);
      router.refresh();
      return;
    }
    setRunReport({
      batchId,
      succeeded: totalSucceeded,
      attempted,
      failures: outcome.failures,
      cancelled: outcome.cancelled,
      snapshot: run,
    });
    if (quotaHitRef.current && !effectiveUnlimited) {
      setQuotaModal({ batchId });
    }
    pushToast(
      "success",
      `Retry done: ${totalSucceeded} of ${attempted} pins ready (${outcome.failures.length} still failing).`
    );
  }

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_360px]">
      {/* Mobile preview at top */}
      <div className="lg:hidden">
        <div className="card space-y-2">
          <p className="text-xs font-semibold text-neutral-700 sm:text-sm">Preview</p>
          <PinPreview
            brand={effectiveBrand}
            contentType={contentType}
            newsTemplate={contentType === "news" ? newsTemplate : undefined}
            backgroundImageUrl={bgPool[0] || null}
            backgroundBlur={effectiveBlur}
            textStyle={textStyle}
            sampleCta={contentType === "news" ? undefined : ctaOverride.trim() || undefined}
            author={contentType === "quote" ? "Preview Author" : undefined}
          />
        </div>
      </div>
      <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="card space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Brand</label>
            <select
              className="input"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {boardsList.length > 0 && (
            <div>
              <label className="label">Saved boards</label>
              <select
                className="input"
                value={selectedBoardId}
                onChange={(e) => onPickSavedBoard(e.target.value)}
              >
                <option value="">— or choose a saved board —</option>
                {boardsList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label flex items-center justify-between">
              <span>Board name</span>
              <button
                type="button"
                onClick={saveCurrentBoard}
                disabled={savingBoard || !boardName.trim() || !userId}
                className="text-xs text-brand hover:underline disabled:cursor-not-allowed disabled:text-neutral-400"
              >
                {savingBoard ? "Saving…" : "+ Save this board"}
              </button>
            </label>
            <input
              className="input"
              value={boardName}
              onChange={(e) => {
                setBoardName(e.target.value);
                setSelectedBoardId("");
              }}
              placeholder="e.g. Daily Quotes"
            />
          </div>
        </div>

      </div>

      <div className="card space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">
            Text &amp; appearance
          </h2>
          {(anyBrandOverride || textStyleCustomized) && (
            <span className="text-[11px] text-neutral-500">
              Batch-only overrides — saved brand untouched
            </span>
          )}
        </div>

        {(anyBrandOverride || textStyleCustomized) && (
          <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            <span>
              All overrides on this card apply to this batch only. Your saved
              brand is not changed.
            </span>
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs"
              onClick={resetTextStyle}
            >
              Reset all
            </button>
          </div>
        )}

        <div className="rounded-md border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-800">Brand bar</p>
            <button
              type="button"
              className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
              onClick={resetBrandBar}
            >
              Reset
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px_120px_120px]">
            <div>
              <label className="label">Font (override)</label>
              <select
                className="input"
                value={fontOverride ?? brand.font}
                onChange={(e) =>
                  setFontOverride(
                    e.target.value === brand.font ? undefined : e.target.value
                  )
                }
              >
                {FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f.split(",")[0].replace(/['"]/g, "")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Text color</label>
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-neutral-300"
                value={textColorImm ?? brand.text_color}
                onChange={(e) => setTextColor(e.target.value)}
                title="Default text + fallback headline color"
              />
            </div>
            <div>
              <label className="label">BG color</label>
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-neutral-300"
                value={bgColorImm ?? brand.bg_color}
                onChange={(e) => setBgColor(e.target.value)}
                title="Solid background when no image"
              />
            </div>
            <div>
              <label className="label">Brand name</label>
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-neutral-300"
                value={brandNameColorImm ?? (textColorImm ?? brand.text_color)}
                onChange={(e) => setBrandNameColor(e.target.value)}
                title="Brand name at top (defaults to Text color)"
              />
            </div>
          </div>
        </div>

        <div className="rounded-md border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-800">Headline</p>
            <button
              type="button"
              className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
              onClick={resetHeadline}
            >
              Reset
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-[120px_1fr_1fr_1fr]">
            <div>
              <label className="label">Text color</label>
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-neutral-300"
                value={headlineTextColorImm ?? (textColorImm ?? brand.text_color)}
                onChange={(e) => setHeadlineTextColor(e.target.value)}
                title="Centered headline + author (defaults to Text color)"
              />
            </div>
            <div>
              <label className="label">Headline backdrop</label>
              <div className="flex h-10 items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-neutral-900"
                  checked={textBgEnabled}
                  onChange={(e) => setTextBgEnabled(e.target.checked)}
                  title="Solid box behind headline text"
                />
                <input
                  type="color"
                  className="h-10 w-16 cursor-pointer rounded-md border border-neutral-300 disabled:opacity-40"
                  value={textBgColorImm}
                  disabled={!textBgEnabled}
                  onChange={(e) => setTextBgColor(e.target.value)}
                  title="Backdrop color"
                />
                <span className="text-xs text-neutral-500">
                  {textBgEnabled ? "On" : "Off"}
                </span>
              </div>
            </div>
            <div>
              <label className="label">Bold</label>
              <div className="flex h-10 items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-neutral-900"
                  checked={textBold}
                  onChange={(e) => setTextBold(e.target.checked)}
                  title="Bold headline + brand bar"
                />
                <span className="text-xs text-neutral-500">
                  {textBold ? "Bold" : "Regular"}
                </span>
              </div>
            </div>
            <div>
              <label className="label">Italic</label>
              <div className="flex h-10 items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-neutral-900"
                  checked={textItalic}
                  onChange={(e) => setTextItalic(e.target.checked)}
                  title="Italic headline + brand bar"
                />
                <span className="text-xs text-neutral-500">
                  {textItalic ? "Italic" : "Roman"}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-neutral-900"
                checked={textShadowEnabled}
                onChange={(e) => setTextShadowEnabled(e.target.checked)}
              />
              Text drop shadows on headline, brand name, and attribution
            </label>
          </div>
        </div>

        <div className="rounded-md border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-neutral-800">CTA pill</p>
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-neutral-900"
                  checked={ctaEnabled}
                  onChange={(e) => setCtaEnabled(e.target.checked)}
                />
                Customize
              </label>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline disabled:opacity-40"
              onClick={resetCta}
              disabled={!ctaEnabled}
            >
              Reset
            </button>
          </div>
          <div
            className={
              "grid gap-4 transition-opacity sm:grid-cols-[120px_120px_1fr] " +
              (ctaEnabled ? "" : "pointer-events-none opacity-40")
            }
          >
            <div>
              <label className="label">Pill BG</label>
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-neutral-300"
                value={ctaBgColorImm}
                onChange={(e) => setCtaBgColor(e.target.value)}
                title="CTA pill background color"
              />
            </div>
            <div>
              <label className="label">Pill text</label>
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-neutral-300"
                value={ctaTextColorImm}
                onChange={(e) => setCtaTextColor(e.target.value)}
                title="CTA pill text color"
              />
            </div>
            <div>
              <label className="label">Weight</label>
              <div className="flex h-10 items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-neutral-900"
                  checked={ctaBold}
                  onChange={(e) => setCtaBold(e.target.checked)}
                  title="Bold CTA button text"
                />
                <span className="text-xs text-neutral-500">
                  {ctaBold ? "700 Bold" : "600 Semibold (default)"}
                </span>
              </div>
            </div>
          </div>
          {!ctaEnabled && (
            <p className="mt-2 text-xs text-neutral-500">
              When disabled, CTA uses brand defaults: {brand.text_color} pill
              with {brand.bg_color} text.
            </p>
          )}
        </div>
      </div>

      <div className="card space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Content type</label>
            <select
              className="input"
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
            >
              <option value="quote">Quote</option>
              <option value="news">News</option>
              <option value="fact">Fact</option>
            </select>
          </div>
          <div>
            <label className="label">Language</label>
            <select
              className="input"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          {contentType === "news" && (
            <div>
              <label className="label">News template</label>
              <select
                className="input"
                value={newsTemplate}
                onChange={(e) => setNewsTemplate(e.target.value as NewsTemplate)}
              >
                <option value="magazine">Magazine feature</option>
                <option value="newspaper">Breaking newspaper</option>
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Uses brand, image, title, description, and optional source.
              </p>
            </div>
          )}
        </div>

        {contentType !== "news" && <div>
          <label className="label">Source link (destination URL)</label>
          <input
            className="input"
            value={sourceLink}
            onChange={(e) => setSourceLink(e.target.value)}
            placeholder={
              contentType === "quote" ? SITE_HOME_URL : "https://your-offer.com/landing"
            }
          />
          <p className="mt-1 text-xs text-neutral-500">
            {contentType === "quote"
              ? `Quotes default to ${SITE_HOME_URL}. Every pin link routes through the monetized redirector. A per-quote link (paste/CSV/JSON) overrides this.`
              : "Every pin link routes through the monetized redirector to this URL."}
          </p>
        </div>}

        <div>
          <label className="label">Call to action (optional)</label>
          <input
            className="input"
            value={ctaOverride}
            onChange={(e) => setCtaOverride(e.target.value)}
            maxLength={80}
            placeholder="e.g. Shop now — leave empty for AI-written CTAs"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Same button text on every pin in this batch. Empty = AI writes a
            CTA per pin.
          </p>
        </div>
      </div>

      <div className="card space-y-5">
        <div>
          <label className="label">Mode</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchAiMode("with")}
              className={aiMode === "with" ? "btn-primary" : "btn-secondary"}
            >
              With AI
            </button>
            <button
              type="button"
              onClick={() => switchAiMode("without")}
              className={aiMode === "without" ? "btn-primary" : "btn-secondary"}
            >
              Without AI
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {aiMode === "with"
              ? "AI writes the title, description, tags and headlines you leave empty. Uses AI credits + pin credits."
              : "No AI calls — every row must carry full details (CSV or JSON only). Uses pin credits only."}
          </p>
          {aiMode === "with" && !hasGeminiKey && (
            <button
              type="button"
              onClick={() => setApiKeyPromptOpen(true)}
              className="mt-2 w-full rounded-md bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
            >
              ⚠️ With-AI needs your own Gemini API key — built-in AI isn&apos;t available yet. Tap here to add your key or switch modes.
            </button>
          )}
        </div>
        <div>
          <label className="label">Input</label>
          <div className="flex flex-wrap gap-2">
            {(
              (aiMode === "with"
                ? [
                    ["paste", "Paste list"],
                    ["topic", "Topic"],
                    ["csv", "CSV import"],
                  ]
                : [
                    ["csv", "CSV import"],
                    ["json", "JSON import"],
                  ]) as [InputMode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setInputMode(m)}
                className={inputMode === m ? "btn-primary" : "btn-secondary"}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {inputMode === "topic" && (
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div>
              <label className="label">Topic</label>
              <input
                className="input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  contentType === "news"
                    ? "e.g. AI industry headlines"
                    : "e.g. space facts"
                }
              />
            </div>
            <div>
              <label className="label">Number of pins</label>
              <input
                type="number"
                min={1}
                max={200}
                className="input"
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(200, Number(e.target.value))))
                }
              />
            </div>
          </div>
        )}

        {inputMode === "paste" && (
          <div>
            <label className="label">
              {contentType === "quote"
                ? "Quotes (one per line)"
                : "Items (one per line)"}
            </label>
            <textarea
              className="input min-h-[160px]"
              value={pasteList}
              onChange={(e) => setPasteList(e.target.value)}
              placeholder={
                contentType === "quote"
                  ? "The best way to predict the future is to invent it. | Alan Kay\nSimplicity is the ultimate sophistication."
                  : "Line one\nLine two\nLine three"
              }
            />
            <p className="mt-1 text-xs text-neutral-500">
              {contentType === "quote" ? (
                <>
                  Per line, separated by <code>|</code>:{" "}
                  <code>
                    quote | author | link | bg | title | description | tags |
                    cta
                  </code>
                  . Only the quote is required — empty fields fall back to
                  AI. Tags are comma-separated.
                </>
              ) : contentType === "news" ? (
                <>
                  Per line, separated by <code>|</code>: <code>headline | link | image | image_title | image_description | pinterest_title | pinterest_description | source</code>.
                  The Pinterest title and description stay separate from the text shown on the image.
                </>
              ) : (
                <>
                  Per line, separated by <code>|</code>:{" "}
                  <code>
                    text | link | bg | title | description | tags | cta |
                    main_line
                  </code>
                  . A line without <code>|</code> is just the text; empty
                  fields fall back to AI.
                </>
              )}{" "}
              <strong>{items.length}</strong> detected.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Note: <code>bg</code> accepts a full URL, <code>default</code>{" "}
              (batch backgrounds), or a Library name like{" "}
              <code>Sunset</code> or <code>Stock 5</code>.
            </p>
          </div>
        )}

        {inputMode === "csv" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={
                  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-sm transition-colors " +
                  (dragging
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-neutral-300 bg-neutral-50 text-neutral-600 hover:border-neutral-400")
                }
                role="button"
                tabIndex={0}
                onClick={() =>
                  document.getElementById("csv-file-input")?.click()
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    document.getElementById("csv-file-input")?.click();
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
                    await handleCsvDrop(e.dataTransfer.files);
                  }
                }}
              >
                <Icon
                  name={dragging ? "fluent-emoji-flat:open-file-folder" : "fluent-emoji-flat:page-facing-up"}
                  size={20}
                />
                <div className="text-center">
                  <p className="font-medium">
                    {dragging ? "Drop CSV file(s) here" : "Drag & drop CSV file(s) here, or click to browse"}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Accepts .csv files. Multiple files will be merged.
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files) {
                      await handleCsvDrop(e.target.files);
                    }
                  }}
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="ml-2 cursor-pointer rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  Choose CSV
                </label>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => downloadSampleCsv(contentType, aiMode === "without")}
              >
                Download sample
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Columns:{" "}
              <code>{columnsForMode(contentType, aiMode === "without").join(", ")}</code>
              {aiMode === "with"
                ? ". Only the required column is mandatory — optional detail cells override AI per row when filled."
                : ". Every row must carry full details (no AI in this mode)."}
              {" "}Any row with an invalid cell is skipped entirely.
            </p>
            <p className="text-xs text-neutral-500">
              Note: the background column accepts a full URL,{" "}
              <code>default</code> (batch backgrounds), or a Library name like{" "}
              <code>Sunset</code> or <code>Stock 5</code>.
            </p>
            {csvName && (
              <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm">
                <p>
                  <strong>{csvName}</strong> — {csvParsed.items.length} valid row
                  {csvParsed.items.length === 1 ? "" : "s"}
                  {csvParsed.skipped.length > 0 && (
                    <span className="text-red-600">
                      , {csvParsed.skipped.length} skipped
                    </span>
                  )}
                </p>
                {csvParsed.skipped.length > 0 && (
                  <ul className="mt-1 max-h-28 list-disc overflow-auto pl-5 text-xs text-red-600">
                    {csvParsed.skipped.map((s) => (
                      <li key={s.row}>
                        Row {s.row}: {s.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {inputMode === "json" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-secondary cursor-pointer">
                Load .json file
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files?.[0]) {
                      await onJsonFile(e.target.files[0]);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={copySampleJson}
              >
                {copiedSample ? "Copied ✓" : "Copy sample JSON"}
              </button>
            </div>
            <div>
              <label className="label">
                JSON array — one object per pin (
                {columnsForMode(contentType, true).join(", ")})
              </label>
              <textarea
                className="input min-h-[160px] font-mono text-xs"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={buildSampleJson(contentType, true)}
                spellCheck={false}
              />
            </div>
            {jsonParsed.error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {jsonParsed.error}
              </p>
            ) : (
              <p className="text-xs text-neutral-500">
                <strong>{jsonParsed.items.length}</strong> valid row
                {jsonParsed.items.length === 1 ? "" : "s"}
                {jsonParsed.skipped.length > 0 && (
                  <span className="text-red-600">
                    , {jsonParsed.skipped.length} skipped
                  </span>
                )}
                . Rows with a missing required field or an invalid URL are
                skipped entirely.
              </p>
            )}
            {jsonParsed.skipped.length > 0 && (
              <ul className="max-h-28 list-disc overflow-auto pl-5 text-xs text-red-600">
                {jsonParsed.skipped.map((s) => (
                  <li key={s.row}>
                    Row {s.row}: {s.reason}
                  </li>
                ))}
              </ul>
            )}
            <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              Note: Without-AI mode makes no AI calls, so every object must
              carry full details ({contentType === "news" ? (
                <><code>image_title</code>, <code>image_description</code>, <code>title</code>, and <code>description</code></>
              ) : (
                <><code>title</code>, <code>description</code>, <code>tags</code> as array or comma-separated, <code>cta</code>
              {contentType !== "quote" ? (
                <>
                  {" "}
                  and <code>main_line</code>
                </>
              ) : (
                ""
              )}</>
              )}
              ) — incomplete rows are skipped above, and only pin credits are
              spent. The background field accepts a full URL,{" "}
              <code>default</code> (batch backgrounds), or a Library name like{" "}
              <code>Sunset</code> or <code>Stock 5</code> (hover a Library
              photo to see its name).
            </p>
            <details className="rounded-md border border-neutral-200 bg-neutral-50">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-600">
                View sample JSON for {contentType}
              </summary>
              <pre className="overflow-x-auto border-t border-neutral-200 p-3 text-xs text-neutral-700">
                {buildSampleJson(contentType, true)}
              </pre>
            </details>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Start datetime (local)</label>
            <input
              type="datetime-local"
              className="input"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Interval (minutes)</label>
            <input
              type="number"
              min={1}
              className="input"
              value={intervalMin}
              onChange={(e) => setIntervalMin(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div>
            <label className="label">Parallel workers</label>
            <select
              className="input"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              title="How many pins generate at once (bounded parallelism)"
            >
              {[2, 4, 6].map((n) => (
                <option key={n} value={n}>
                  {n} parallel
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <label className="label mb-0">Backgrounds</label>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPickerOpen(true)}
          >
            <Icon name="fluent-emoji-flat:framed-picture" size={16} />
            Choose backgrounds
          </button>
        </div>
        {bgPool.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {bgPool.map((u, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt=""
                  className="h-20 w-14 rounded-md border border-neutral-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setBgPool((p) => p.filter((_, x) => x !== i))}
                  className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-xs text-white"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500">
            No shared backgrounds selected. Per-item backgrounds (CSV/paste/JSON)
            still apply; otherwise the brand background color is used. Upload or
            pick from the library.
          </p>
        )}
        <p className="text-xs text-neutral-500">
          1 selected → used for all pins. Multiple → cycled per pin.
        </p>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-neutral-900"
              checked={bgBlurEnabled}
              onChange={(e) => setBgBlurEnabled(e.target.checked)}
            />
            Blur background
          </label>
          {bgBlurEnabled && (
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={MAX_BG_BLUR}
                step={1}
                value={bgBlurPx}
                onChange={(e) => setBgBlurPx(Number(e.target.value))}
                className="w-full"
                aria-label="Background blur strength in pixels"
              />
              <span className="w-14 shrink-0 text-right text-sm tabular-nums text-neutral-600">
                {bgBlurPx}px
              </span>
            </div>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            {bgBlurEnabled
              ? `Softens background images (${bgBlurPx}px). Text stays sharp.`
              : "Off — backgrounds render unblurred."}
          </p>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            {effectiveUnlimited ? (
              <p className="flex items-center gap-2 text-sm text-green-700">
                <Icon name="fluent-emoji-flat:white-check-mark" size={16} />
                API key Being used. No credits will be spent.
              </p>
            ) : (
              <>
                <p className="text-sm text-neutral-500">
                  AI credits:{" "}
                  <span className="font-bold text-neutral-900">{aiCredits}</span>
                  {" · "}Pin credits:{" "}
                  <span className="font-bold text-neutral-900">{credits}</span>
                </p>
                <p className="text-sm text-neutral-500">
                  This batch will use{" "}
                  <span className="font-bold text-neutral-900">
                    {aiMode === "with" ? items.length : 0}
                  </span>{" "}
                  AI credits +{" "}
                  <span className="font-bold text-neutral-900">{items.length}</span>{" "}
                  pin credits.
                </p>
              </>
            )}
          </div>
          <button
            onClick={requestGenerate}
            className="btn-primary"
            disabled={generating}
          >
            {generating
              ? `Generating ${progress.done}/${progress.total}…`
              : "Review & generate"}
          </button>
        </div>
        {hasGeminiKey && (
          <div className={`rounded-md bg-neutral-50 px-3 py-2 ${aiMode === "without" ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="fluent-emoji-flat:coin" size={16} />
              <span className="text-sm text-neutral-700">
                Use account credits instead of my API key
              </span>
            </div>
            <label className={`relative inline-flex items-center ${aiMode === "without" ? "cursor-not-allowed" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={!useCustomKey}
                disabled={toggleBusy || generating || aiMode === "without"}
                title={aiMode === "without" ? "Not needed in Without-AI mode (no AI calls)" : "Toggle between your API key and account credits"}
                onChange={(e) => toggleUseCustomKey(!e.target.checked)}
              />
              <div className="h-5 w-9 rounded-full bg-neutral-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand peer-checked:after:translate-x-full peer-disabled:opacity-50"></div>
            </label>
            </div>
            {aiMode === "without" && (
              <p className="mt-1 text-xs text-neutral-500">
                Disabled in Without-AI mode — no AI calls are made, so this choice makes no sense here.
              </p>
            )}
          </div>
        )}
      </div>

      {generating && (
        <div className="card space-y-3 border-brand/30 bg-brand/5 p-4" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-brand/25 border-t-brand"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {generationStage}
              </p>
              <p className="text-xs text-neutral-500">
                Keep this window open while your pins are being prepared.
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-brand">
              {progress.done}/{progress.total}
            </span>
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => {
                cancelRef.current = true;
                setGenerationStage("Cancelling — finishing current pins…");
              }}
            >
              Cancel
            </button>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-brand transition-all duration-500"
              style={{
                width: `${(progress.done / Math.max(1, progress.total)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {runReport && !generating && (
        <div className="card space-y-3 border-amber-300 bg-amber-50/60">
          <h3 className="font-semibold text-neutral-900">
            {runReport.cancelled
              ? "Generation cancelled"
              : "Batch finished with failures"}
          </h3>
          <p className="text-sm text-neutral-700">
            {runReport.succeeded} of {runReport.attempted} pins saved.
            {runReport.failures.length > 0 &&
              ` ${runReport.failures.length} failed — usually a temporary Gemini rate limit. Wait a minute, then retry just those.`}
          </p>
          {runReport.failures.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-auto rounded-md bg-white/70 p-3 text-xs">
              {runReport.failures.map((f) => (
                <li key={f.index} title={f.message}>
                  <strong>Pin {f.index + 1}:</strong>{" "}
                  <span className="text-neutral-600">
                    {f.message.length > 220
                      ? `${f.message.slice(0, 220)}…`
                      : f.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {runReport.failures.length > 0 && (
              <button type="button" className="btn-primary" onClick={runRetry}>
                Retry failed ({runReport.failures.length})
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push(`/dashboard/batches/${runReport.batchId}`)}
            >
              View batch
            </button>
          </div>
        </div>
      )}

      <BackgroundPicker
        open={pickerOpen}
        initial={bgPool}
        onClose={() => setPickerOpen(false)}
        onApply={(urls) => {
          setBgPool(urls);
          setPickerOpen(false);
        }}
      />

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md space-y-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Icon name="fluent-emoji-flat:white-check-mark" size={20} />
              Confirm batch
            </h2>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Content type</dt>
                <dd className="font-medium capitalize">{contentType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Board</dt>
                <dd className="font-medium">{boardName.trim()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Pins</dt>
                <dd className="font-medium">{items.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-neutral-500">Font</dt>
                <dd className="truncate font-medium">
                  {effectiveBrand.font.split(",")[0].replace(/['"]/g, "")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-neutral-500">CTA</dt>
                <dd className="truncate font-medium">
                  {ctaOverride.trim() || "AI-written"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-neutral-500">Details</dt>
                <dd className="truncate font-medium">
                  {aiMode === "without"
                    ? "Fully specified by you (no AI)"
                    : items.some(
                        (it) =>
                          it.title || it.description || (it.tags ?? []).length > 0 || it.cta || it.mainLine
                      )
                      ? "Custom where provided, AI fills the rest"
                      : "AI-generated"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-neutral-500">Text style</dt>
                <dd className="truncate font-medium" title={
                  [
                    `${textBold ? "Bold" : "Regular"}${textItalic ? " + Italic" : ""}`,
                    headlineTextColorImm ? `Headline: ${headlineTextColorImm}` : null,
                    brandNameColorImm ? `Brand: ${brandNameColorImm}` : null,
                    textStyle.textBgColor ? `Headline bg: ${textStyle.textBgColor}` : null,
                    !textShadowEnabled ? "No shadows" : null,
                    ctaEnabled
                      ? `CTA: ${ctaBold ? "bold " : ""}${ctaTextColorImm} on ${ctaBgColorImm}`
                      : null,
                  ].filter(Boolean).join("; ")
                }>
                  {[
                    `${textBold ? "Bold" : "Regular"}${textItalic ? "/Italic" : ""}`,
                    headlineTextColorImm ? "custom headline" : null,
                    textStyle.textBgColor ? "headline bg" : null,
                    !textShadowEnabled ? "flat (no shadows)" : null,
                    ctaEnabled ? "custom CTA" : null,
                  ].filter(Boolean).join(", ")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Background blur</dt>
                <dd className="font-medium">
                  {bgBlurEnabled ? `${bgBlurPx}px` : "Off"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">AI credits after</dt>
                <dd className="font-medium">
                  {effectiveUnlimited
                    ? "API key Being used"
                    : aiMode === "with"
                      ? aiCredits - items.length
                      : aiCredits}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Pin credits after</dt>
                <dd className="font-medium">
                  {effectiveUnlimited ? "API key Being used" : credits - items.length}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-neutral-500">Default link</dt>
                <dd className="truncate font-medium" title={sourceLink.trim()}>
                  {sourceLink.trim()}
                </dd>
              </div>
            </dl>
            {((inputMode === "csv" && csvParsed.skipped.length > 0) ||
              (inputMode === "json" && jsonParsed.skipped.length > 0)) && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {(inputMode === "csv" ? csvParsed.skipped.length : jsonParsed.skipped.length)}{" "}
                invalid row(s) will be ignored.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={runGenerate}>
                Confirm & generate
              </button>
            </div>
          </div>
        </div>
      )}

      {quotaModal && !generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md space-y-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Icon name="fluent-emoji-flat:warning" size={20} />
              Gemini quota exhausted
            </h2>
            <p className="text-sm text-neutral-700">
              Generation was stopped because the shared Gemini quota ran out
              (free tier is limited to about 20 requests/day). Your finished
              pins are saved — AI credits were only spent on those.
            </p>
            <p className="text-sm text-neutral-700">
              To continue right away, add your own Gemini API key — it uses your
              own key instead of shared credits.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => setQuotaModal(null)}
              >
                Later
              </button>
              <button
                className="btn-secondary"
                onClick={() =>
                  router.push(`/dashboard/batches/${quotaModal.batchId}`)
                }
              >
                View batch
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setQuotaModal(null);
                  router.push("/dashboard/settings");
                }}
              >
                Add API key
              </button>
            </div>
          </div>
        </div>
      )}

      {apiKeyPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md space-y-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Icon name="fluent-emoji-flat:key" size={20} />
              API key required for With-AI
            </h2>
            <p className="text-sm text-neutral-700">
              With-AI mode needs your own Gemini API key — built-in AI is not
              available on the site yet. Add your key in Settings to continue,
              or switch to Without-AI mode (CSV/JSON with full details, pin
              credits only).
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setApiKeyPromptOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setApiKeyPromptOpen(false);
                  switchAiMode("without");
                }}
              >
                Use Without-AI
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setApiKeyPromptOpen(false);
                  router.push("/dashboard/settings");
                }}
              >
                Add API key
              </button>
            </div>
          </div>
        </div>
      )}

      </div>

      <div className="hidden lg:block">
        <div className="sticky top-6">
          <div className="card space-y-3">
            <p className="text-sm font-semibold text-neutral-700">Preview</p>
            <PinPreview
              brand={effectiveBrand}
              contentType={contentType}
              newsTemplate={contentType === "news" ? newsTemplate : undefined}
              backgroundImageUrl={bgPool[0] || null}
              backgroundBlur={effectiveBlur}
              textStyle={textStyle}
              sampleCta={contentType === "news" ? undefined : ctaOverride.trim() || undefined}
              author={contentType === "quote" ? "Preview Author" : undefined}
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              t.type === "error"
                ? "max-w-sm rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg"
                : "max-w-sm rounded-md bg-green-600 px-4 py-2 text-sm text-white shadow-lg"
            }
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
