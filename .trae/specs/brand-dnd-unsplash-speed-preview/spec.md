# TechTreasure — Batch UX, Speed & Brand Edit: Product Requirements Document

## Overview
- **Summary**: Five coordinated improvements to the Pinterest Pin batch creation pipeline: (1) add brand editing both on the dashboard and per-batch inline override controls, (2) add drag-and-drop (DnD) file upload for CSV imports and background images, (3) remove all Unsplash API integrations and keep only the built-in local library plus user uploads, (4) reduce end-to-end time for a pin batch by parallelizing independent work, and (5) let users pick from an expanded font palette + custom text/background colors with a live preview canvas tied to their chosen backgrounds.
- **Purpose**: Unblock users whose content creation is slowed by missing brand edits, awkward upload UX, broken/missing Unsplash keys, long serial generation times, and inability to preview styling before generating a batch.
- **Target Users**: TechTreasure creators (content marketers, Pinterest VA's, small business owners) who generate 20-200 pin batches per session.

## Goals
- User can edit any saved brand (name/logo/colors/font) from the dashboard.
- User can override brand styling (text color, bg color, font) directly inside the Batch form before generating a batch without mutating the saved brand record.
- User can import CSV pin lists and upload background images by dropping files onto a visible DnD zone.
- Background picker and app no longer reference Unsplash at all; the "Library" tab contains only local gradient/SVG presets and the user's previously-uploaded backgrounds from Supabase storage.
- Pin batch throughput improves measurably compared with the current strictly-serial loop.
- User can see a live 2:3 preview of their pin (with the currently-selected background, brand overrides, and sample text) updating in real time in the Batch form before they click Generate.
- Final generated CSV and ZIP still satisfy every Pinterest column rule from the prior round.

## Non-Goals
- No database schema migrations (brand table already stores all required columns).
- No paywall/plan changes around fonts or backgrounds.
- No server-side rendering changes; all new features remain client-side.
- No changes to the generate-meta edge function contract itself.
- No changes to Pin/ZIP/CSV export column rules (already verified passing).

## Background & Context
- Current brand card on `/dashboard/brands` has no Edit action (only Delete + New). Users must re-create a brand to tweak colors.
- Brand selection inside `BatchForm` is a simple `<select>` of saved brands with no visual preview of colors/fonts and no ability to override values for a single batch.
- CSV input uses a hidden `<input type=file>` triggered by a button with no DnD; background uploads similarly rely on the file picker inside the modal.
- `src/lib/backgrounds.ts:BG_PRESETS` contains 27 presets, 25 of which point to `images.unsplash.com` URLs — these fail to render when the user has no internet/unsplash key, and the requirement explicitly says "Remove unsplash images".
- `BackgroundPicker.tsx` has a 3-tab layout (Unsplash / upload / library) with Unsplash as default and first tab.
- Pin generation in `runGenerate` (`BatchForm.tsx:206-263`) runs as `for (let i = 0; i < total; i++) await onePin()` — each pin waits for Gemini metadata, canvas render, storage upload, and a Supabase insert before the next one starts. Most of these steps are network-bound and parallel-safe across different pins.
- `renderPin.ts` already takes a `brand: Brand` object with `text_color`, `bg_color`, `font`, `logo_url` — so a preview component can reuse the exact same rendering function.
- Current `FONTS` array has only 6 generic system fonts. Users expect a broader palette including display fonts (serif display, grotesque, slab, etc.) — all using Google Fonts via `<link>` tag + fallbacks so no file downloads are needed.

## Functional Requirements
- **FR-1**: `/dashboard/brands` shows an "Edit" button on every brand card; clicking navigates to `/dashboard/brands/[id]` (or opens an edit form) pre-populated with the brand's current values; submit updates the `brands` row and returns to the brands list.
- **FR-2**: `BrandForm` supports both create mode (existing: empty defaults) and edit mode (prop-filled: given `brandId` or `initialBrand`); fields, logo upload, and preview behave identically in both modes.
- **FR-3**: `BatchForm` exposes an inline brand override panel next to the brand dropdown: three controls — font picker, text color picker, background color picker — plus an optional logo file/URL input; overrides are applied only to the current batch and do not write to the `brands` table.
- **FR-4**: Batch form CSV input has an explicitly rendered DnD zone: dragover highlights, drop reads the file(s), calls the existing `onCsvFile` parser; multiple CSV files are concatenated; the zone remains accessible via keyboard (existing file picker as fallback).
- **FR-5**: BackgroundPicker "Upload" tab has a DnD drop zone with drag visual state; dropped files go through the existing `onUpload` handler.
- **FR-6**: BackgroundPicker tab list contains only two tabs: `library` and `upload` (the `search` / Unsplash tab is removed from the UI, tab type, default state, and routing logic).
- **FR-7**: `BG_PRESETS` and the Library tab show only local/self-hosted assets. Presets with Unsplash URLs are replaced with new gradient or SVG presets (keeping the 2:3 preview); if user-uploaded backgrounds exist in the Supabase `backgrounds` bucket, the Library tab also surfaces those under a "Yours" section.
- **FR-8**: `image-proxy` route whitelist no longer allows `images.unsplash.com` or `plus.unsplash.com` hosts.
- **FR-9**: `/api/unsplash` route is removed or disabled (return 404/410 and the route handler file is deleted).
- **FR-10**: Dashboard guides page and any in-app copy mentioning "Unsplash" is rewritten to say "upload from your computer or pick from the built-in library".
- **FR-11**: Generation loop `runGenerate` pipelines independent work: metadata calls for pin N+1 are allowed to start before pin N finishes uploading (bounded concurrency, e.g. 3-6 workers); storage uploads and pin row inserts remain idempotent per-pin.
- **FR-12**: FONTS list is expanded to at least 16 fonts using Google Fonts families with graceful system-font fallbacks; a `<link rel="preconnect">` to `fonts.googleapis.com` and the families stylesheet is mounted during initial page layout so fonts are ready for canvas rendering; font selection controls render sample text in the chosen family.
- **FR-13**: `BatchForm` shows a live preview card that renders a 333×500 (2:3) mini pin using `renderPin` + synthetic `GeneratedMeta` (sample main line, CTA, title, author) and the user's current brand overrides + first selected background (or gradient fallback); preview updates instantly whenever the user changes font, text color, background color, brand selection, or the background pool.

## Non-Functional Requirements
- **NFR-1**: Build succeeds with zero TypeScript errors.
- **NFR-2**: Preview renders at ≤100 ms per change after first paint (use offscreen canvas/memoization; don't re-render when unrelated form fields change).
- **NFR-3**: DnD drop zones work on both desktop (file explorer drops) and do not break the existing file input click path.
- **NFR-4**: Parallel pin generation never exceeds 8 concurrent network operations (Gemini + Supabase) per batch to avoid rate limiting.
- **NFR-5**: Progress counter and toast error reporting remain accurate for the new parallel loop (i.e., `progress.done` counts the same completed/failed pins).

## Constraints
- **Technical**: All rendering happens with the HTML5 canvas API (`renderPin.ts`). Fonts loaded via Google Fonts `<link>` must use the `document.fonts.ready` pattern before drawing text to avoid a blank canvas on first render.
- **Technical**: Background image presets must not load any remote hosts other than Supabase project storage (`qgrmwyktmthfasjmegdp.supabase.co`) — because the goal is to remove Unsplash entirely.
- **Business**: The redirector link pattern (`NEXT_PUBLIC_SITE_URL/redirector.html?url=...`) must not change for any export.
- **Dependencies**: No new heavy libraries. Native DnD API only for drops. JSZip, PapaParse, and Supabase SDK remain the only third-party runtime data tools. Google Fonts are loaded via standard `<link>` (not an npm package).

## Assumptions
- Users' browsers support modern DnD API and `<input type=color>`.
- Google Fonts CDN is reachable when internet is available; fallback system fonts render offline without errors.
- `generate-meta` edge function rate limit is the main bottleneck for pin throughput; bounded concurrency 4-6 should saturate without triggering 429s.
- Saved user backgrounds in the `backgrounds` Supabase bucket all live under a `{user.id}/` prefix (matches the upload handler and RLS policies), so we can list them safely.

## Acceptance Criteria

### AC-1: Brand edit flow works end-to-end
- **Type**: `rule`
- **Given**: An authenticated user with at least one saved brand on `/dashboard/brands`
- **When**: The user clicks "Edit" on a brand card, changes name/logo/colors/font, and saves
- **Then**: The brands table reflects the updated values; the brands list page shows the new preview; no new brand row is created
- **Pass Condition**: UPDATE `brands WHERE id = ?` observed, no new row, dashboard reflects changes
- **Evidence**: Network panel showing Supabase UPDATE, build logs passing, manual navigation check

### AC-2: Batch form brand overrides apply without saving to the brand record
- **Type**: `rule`
- **Given**: User has a brand called "Default" (white text, red bg, Georgia)
- **When**: Inside a new batch they select "Default", open overrides, pick blue text + yellow bg + Helvetica, then generate pins
- **Then**: The rendered pins show blue-on-yellow in Helvetica; the "Default" brand row is unchanged; subsequent batches default back to white/red/Georgia
- **Pass Condition**: Supabase `brands SELECT` shows original values; PNG blobs from `rendered-pins` have the override color profile (inspect one pixel or URL hash difference)
- **Evidence**: Build + screenshot of preview + SELECT query output

### AC-3: CSV DnD imports files identically to the picker
- **Type**: `rule`
- **Given**: A valid `sample-pins.csv` with 10 rows
- **When**: User drags the file onto the batch-form CSV DnD zone
- **Then**: `csvItems.length === 10`, `csvName === 'sample-pins.csv'`, skipped rows info matches the file-picker path for the same file
- **Pass Condition**: Parsed array equality for same CSV through both paths; TypeScript clean
- **Evidence**: Console.log of parsed items for drop vs click; no browser errors during drag/drop events

### AC-4: Background DnD upload inside the picker works
- **Type**: `rule`
- **Given**: BackgroundPicker open on Upload tab
- **When**: User drops 3 PNG/JPG files onto the DnD zone
- **Then**: All 3 appear in `selected` array, and `backgrounds` storage bucket has 3 new objects under the user's uid folder
- **Pass Condition**: 3 successful `storage.upload` calls observed; no lost files; build passes
- **Evidence**: Storage object list before/after; selected array length

### AC-5: Unsplash tab, route, and URL references are gone
- **Type**: `rule`
- **Given**: A production build and source code search
- **When**: Grep for "unsplash" (case insensitive) and inspect BackgroundPicker DOM tabs
- **Then**: No `/api/unsplash` route file exists; BackgroundPicker has 2 tabs (Library + Upload) with Library as default; `BG_PRESETS` entries have no `images.unsplash.com` URLs; proxy whitelist excludes unsplash; guides copy does not mention "Unsplash"; all old presets are replaced with gradients/SVGs
- **Pass Condition**: `grep -ri unsplash src/` returns 0 matches; build passes; UI screenshot shows only Library + Upload tabs
- **Evidence**: grep output; BackgroundPicker screenshot

### AC-6: Batch generation is observably faster than serial
- **Type**: `rubric`
- **Dimension**: Batch throughput speedup vs baseline serial loop
- **Scale**: 1-5
- **Anchors**: 1 = no speedup (still strictly serial); 3 = ~1.7× faster for 20-pin batches on an 8-Mbps connection; 5 = ≥3× faster for 50-pin batches with identical success rate
- **Pass Threshold**: >= 4
- **Evidence**: Timestamps logged at top and bottom of `runGenerate` for a 20-pin batch before/after change; same Supabase project, same network; success count identical

### AC-7: Font palette expanded and preview canvas renders live
- **Type**: `rule`
- **Given**: Fresh Batch form, brand overrides visible
- **When**: User opens the font dropdown (16+ entries listed), switches fonts, changes text color, changes bg color, adds a background
- **Then**: The 333×500 preview canvas re-renders within 120 ms, the selected font's glyphs are actually used in the preview (not a fallback), and background image visibly changes; font `<link>` elements for all listed families are present in `<head>`
- **Pass Condition**: head contains Google Fonts stylesheet; preview canvas pixel check shows new colors; font rendering distinct between two distinct families
- **Evidence**: DOM head inspection; screenshots of preview before and after font/color changes

## Open Questions
- [ ] What exact concurrency limit to default to? (Proposed default: 4; adjustable via a slider from 2-6 for power users.)
- [ ] Any preferred Google Font families? (Proposed: add 10 display/body families — Inter, Playfair Display, Roboto Slab, Poppins, Lora, Merriweather, Montserrat, Source Sans Pro, Oswald, Libre Baskerville — and keep existing 6 system fallbacks for a 16-font total.)
