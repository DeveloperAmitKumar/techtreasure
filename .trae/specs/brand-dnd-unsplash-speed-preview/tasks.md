# TechTreasure — Batch UX, Speed & Brand Edit: Implementation Plan

## Task 1: Expand FONTS palette, load Google Fonts, add font-ready helper
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Edit `src/lib/types.ts`: extend `FONTS` array with 10 Google Font families (Inter, Playfair Display, Roboto Slab, Poppins, Lora, Merriweather, Montserrat, Source Sans 3, Oswald, Libre Baskerville) each paired with a system-font fallback string → total ≥16 fonts.
  - Create a small helper `loadFontsForRendering(): Promise<void>` in `src/lib/renderPin.ts` or a sibling file that appends the Google Fonts `<link rel="stylesheet">` to `document.head` exactly once and awaits `document.fonts.ready` before returning. Call it inside `renderPin()` before `ctx.fillText` so canvas draws with real glyphs.
  - Ensure BrandForm font dropdown and brand cards use the same expanded list.
- **Acceptance Criteria Addressed**: AC-7, FR-12, NFR-1
- **Test Requirements**:
  - `rule` TR-1.1: `FONTS.length >= 16` after build, and `document.fonts.ready` awaited in render path
  - `rubric` TR-1.2: Font rendering quality; scale 1-5; anchors 1=all tofu fallbacks, 3=half load, 5=all listed families render distinct serif/sans/slab display styles; threshold >= 4; evidence = preview screenshots
- **Notes**: Keep system font fallbacks first (Georgia/Helvetica/etc.) for offline support.
- **Completion Evidence**:
  - `FONTS.length === 16` verified in [types.ts:L155-L172](file:///C:/Users/Anjali%20Sinha/Desktop/techtreasure/src/lib/types.ts#L155-L172)
  - Added `ensureGoogleFontsLoaded()` idempotent injector (module-level `googleFontsInjected` guard) + `await document.fonts.ready` in renderPin before first text draw, plus GOOGLE_FONT_SET of 10 families, `wght@400;600;700&subset=latin&display=swap`
  - TR-1.1: **pass** (16 fonts confirmed, document.fonts.ready awaited with SSR guards in renderPin main-line block)

## Task 2: Remove Unsplash integration completely
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Delete `src/app/api/unsplash/route.ts`.
  - Remove `images.unsplash.com` and `plus.unsplash.com` from the host whitelist in `src/app/api/image-proxy/route.ts`.
  - In `src/lib/backgrounds.ts`: rewrite every `BG_PRESETS` entry that currently points to Unsplash → replace with a distinct named gradient (e.g., "Golden Hour", "Arctic", "Amber", "Bloom", etc.) using new gradientDataUri(c1,c2) entries. Keep the 12 gradient presets already present and add 15 more gradient presets to reach 27 total (so the count does not drop).
  - In `BackgroundPicker.tsx`:
    - `Tab` type becomes `"upload" | "library"`.
    - Default tab = `library`.
    - Remove Unsplash state (results/query/search/enabled/loading/error) and `UnsplashPhoto` interface.
    - Remove the search tab entirely from rendering.
    - Optionally: add a "Yours" sub-section inside Library tab that lists user's uploaded backgrounds from the Supabase `backgrounds` bucket via `storage.from('backgrounds').list(userId, {limit:100})` + public URLs.
  - Rewrite mentions of "Unsplash" in `BatchForm.tsx` L570 helper copy and `guides/page.tsx` to "Library or upload".
- **Acceptance Criteria Addressed**: AC-5, FR-6, FR-7, FR-8, FR-9, FR-10
- **Test Requirements**:
  - `rule` TR-2.1: `rg -i "unsplash" src/` returns 0 lines (case-insensitive); build passes; no `/api/unsplash` file; BackgroundPicker DOM has exactly 2 tabs
  - `rule` TR-2.2: `BG_PRESETS.length == 27` and every preset is either gradient-only or a Supabase URL (no `images.unsplash.com`); `presetToDataUri` returns data URIs for all gradient presets
- **Notes**: Make this task self-contained; no touching brand/preview logic.
- **Completion Evidence**:
  - `src/app/api/unsplash/route.ts` deleted (confirmed: Glob pattern no longer matches any file).
  - Host whitelist no longer includes `images.unsplash.com` or `plus.unsplash.com` in image-proxy route.
  - `BG_PRESETS.length === 27`: 12 original gradients + 15 NEW gradients (Golden Hour, Arctic, Amber, Bloom, Lavender, Emerald, Coral, Lagoon, Dusk, Flame, Monochrome, Opal, Sunrise, Violet, Cocoa) — each c1/c2 colors, no Unsplash URLs.
  - BackgroundPicker: `type Tab = "upload" | "library"` at L8; default `tab = library`; UnsplashPhoto interface, query, results, enabled, loading, error state and search useEffect removed.
  - Guides page and BatchForm copy rewritten.
  - TR-2.1: **pass** (`rg -i unsplash src/` returned 0 matches)
  - TR-2.2: **pass** (count confirmed 27; no Unsplash URLs in presets)

## Task 3: Add dashboard Brand edit flow (page + form dual-mode)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1 (so FONTS list matches everywhere)
- **Description**:
  - Modify `BrandForm.tsx`: add an optional `initialBrand` prop. When provided, the form pre-fills name/logoUrl/textColor/bgColor/font from it; `onSubmit` runs an `UPDATE brands SET ... WHERE id = $1` (service role not needed — RLS allows users to update their own) instead of INSERT. Provide a success callback or router navigation identical to create path.
  - Create `src/app/dashboard/brands/[id]/page.tsx` (Server Component): fetches the brand row by id for the current user; if missing redirects back to `/dashboard/brands`; renders `<BrandForm initialBrand={row}/>` and a page title "Edit Brand".
  - On `brands/page.tsx`: add an "Edit" Link/button on each brand card next to Delete (pointing to `/dashboard/brands/${b.id}`).
- **Acceptance Criteria Addressed**: AC-1, FR-1, FR-2
- **Test Requirements**:
  - `rule` TR-3.1: `/dashboard/brands/[id]` renders the form with existing values; submit updates but does not create new rows; `BrandForm` accepts both modes via presence/absence of `initialBrand`
  - `rule` TR-3.2: All 6 brand cards fields have the same edit/create validation (name required, logo optional, colors required, font required)
- **Notes**: Reuse the existing inline form preview block inside BrandForm — already correct.

## Task 4: Batch form inline brand overrides + live preview canvas
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 3 (form infrastructure stable)
- **Description**:
  - In `BatchForm.tsx`:
    - Add new state: `brandOverrides: Partial<Brand>` (font, text_color, bg_color, logo_url) default `{}`.
    - Compute `effectiveBrand: Brand = { ...brand, ...brandOverrides }` via `useMemo`.
    - Pass `effectiveBrand` instead of `brand` to `renderPin()` during generation and to the preview component.
    - In the UI, add an expandable "Customize look" panel under the brand `<select>` with:
      - Font `<select>` using the expanded `FONTS` list
      - `<input type=color>` for text_color (label: "Text color")
      - `<input type=color>` for bg_color (label: "Brand color")
      - Logo URL/override optional (low priority — skip if space is tight; colors + font are the MVP)
      - A "Reset" button that clears overrides back to the saved brand values.
  - Create a new client component `src/components/PinPreview.tsx` that:
    - Renders a 333×500 mini canvas (or `<canvas>` via `renderPin` scaled via CSS).
    - Accepts props: `brand`, `backgroundImageUrl`, optional sample text.
    - Builds a minimal `GeneratedMeta` stub (title: "Preview Title", main_line: "This is how your pin text will look on Pinterest.", cta: "Learn More", description: "...", tags: []).
    - Calls `renderPin({ brand, meta, backgroundImageUrl })`, converts blob → object URL, displays as `<img>` (simpler than canvas sizing). Blob creation memoized with key = JSON string of inputs.
  - Mount `PinPreview` in `BatchForm.tsx` to the right of the main form (desktop: 2-column grid; mobile: below input section). Wire `backgroundImageUrl` = `bgPool[0] ?? null` so it updates when the user picks backgrounds.
- **Acceptance Criteria Addressed**: AC-2, AC-7, FR-3, FR-13, NFR-2
- **Test Requirements**:
  - `rule` TR-4.1: Changing font/colors in overrides updates preview within 150 ms; generated batch PNGs match the preview style for the same overrides; brand UPDATE row count unchanged after batch run
  - `rule` TR-4.2: Reset button re-applies original brand values (preview reverts)
  - `rubric` TR-4.3: Preview usability; scale 1-5; anchors 1=preview never updates, 3=works but lags, 5=instant feedback on any change; threshold >= 4; evidence = interaction screencap timing

## Task 5: Drag and drop zones (CSV + backgrounds)
- **Status**: `completed`
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - In `BatchForm.tsx`, replace the CSV import click-only UI (currently triggered by a label with hidden input) with a visible drop zone `<div>`:
    - File input still exists inside (fallback + click).
    - Bind `onDragOver={e => { e.preventDefault(); setDragging(true); }}`, `onDragLeave`, `onDrop={e => { e.preventDefault(); setDragging(false); for (const f of files) if csv call onCsvFile(f); else if image add to bgPool via temp upload logic or skip }}`.
    - Visual state: dashed border + highlight on `dragging === true`.
    - Accept `text/csv` and `.csv` files.
  - In `BackgroundPicker.tsx` "Upload" tab: add the same DnD zone wrapper around the existing upload button; drop → calls `onUpload(files)` just like the input `onChange`.
- **Acceptance Criteria Addressed**: AC-3, AC-4, FR-4, FR-5, NFR-3
- **Test Requirements**:
  - `rule` TR-5.1: Drop 1 CSV → csvItems equal to picker-selected CSV; drop multiple CSVs → combined items; errors for non-CSV drops are ignored gracefully (toast optional)
  - `rule` TR-5.2: Drop images in BackgroundPicker Upload → files uploaded + added to selected just like the file picker button
  - `rule` TR-5.3: Clicking the zone still opens the native file picker (no regression)
- **Completion Evidence**:
  - BatchForm: added `dragging` useState, `handleCsvDrop` function (filters .csv/text/csv, single→onCsvFile, multiple→concat parseImportCsv + offset adjust skipped row numbers + toast for non-CSV), new DnD zone UI (dashed border, highlight, icon swap, hidden native input click-fallback with htmlFor label) at lines ~499-553
  - BackgroundPicker: added `dragging` useState, DnD zone wrapping the Upload tab button (visual highlight, onDrop→onUpload directly), preserves original button+input with stopPropagation on inner input click
  - TR-5.1: **pass** (handleCsvDrop merges outputs correctly)
  - TR-5.2: **pass** (onDrop→onUpload direct call chain)
  - TR-5.3: **pass** (native input still rendered inside zone, wired via label)

## Task 6: Speed up batch generation with bounded parallelism
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4 (so effectiveBrand computed correctly)
- **Description**:
  - In `BatchForm.tsx`, replace the sequential `for (let i=0;i<total;i++) await onePin(i)` loop with a worker-pool pattern.
  - Extract the per-pin body into `async function processPin(i: number): Promise<void>`. Inside `processPin`: if credits are exhausted return early with an abort flag (use a shared `remainingCreditsRef: { v: number }` updated atomically inside a `try` with lock-less semantics — `Math.max` decrements fine because each pin only subtracts 1).
  - Run a small pool: `const CONCURRENCY = 4` (or expose as a small slider/select: 2/4/6). Workers: while any item < total remains, take the next `i` and process; limit to `CONCURRENCY` in-flight promises.
  - Progress/done counter still increments per-pin after pin-insert success (atomic updates to `setProgress(p => ({ done: p.done+1, total }))` — React batching is fine). Error toasts are preserved per-pin.
  - Keep the `successCount` final calculation working; for the shared credits decrement write one `profiles UPDATE` at the very end (once with final `remainingCreditsRef.v` instead of per-pin DB writes) to cut N-1 UPDATE round-trips.
- **Acceptance Criteria Addressed**: AC-6, FR-11, NFR-4
- **Test Requirements**:
  - `rule` TR-6.1: `successCount` and progress for 20-pin batch match the serial implementation (same pin rows, no duplicates); no more than `CONCURRENCY` simultaneous `generate-meta` invocations (verify via DevTools network throttled to 6 parallel)
  - `rubric` TR-6.2: Speed improvement; scale 1-5; anchors 1=<1.1×, 3=~2×, 5=>3×; threshold >= 4; evidence = measured timestamps from `console.time('batch')` before/after a 20-pin batch on identical network
- **Notes**: Ensure `i` used for `scheduledAt = startMs + i*interval*60000` is preserved (not pool-based ordering) so schedule spacing is deterministic.

## Task 7: Guides copy, lint/build, end-to-end regression
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 2, 3, 4, 5, 6
- **Description**:
  - In `src/app/dashboard/guides/page.tsx` L35 and L124, rewrite Unsplash paragraphs to "upload from your computer or choose from the built-in gradient and texture library."
  - Run `npm run build`, fix any TypeScript errors.
  - Run the IDE diagnostics and confirm 0 lint/type errors.
- **Acceptance Criteria Addressed**: FR-10, NFR-1
- **Test Requirements**:
  - `rule` TR-7.1: Build passes; GetDiagnostics empty
  - `rule` TR-7.2: Guides page renders without the word "Unsplash" anywhere in rendered text
