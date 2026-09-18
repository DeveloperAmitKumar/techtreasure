# Text Settings Optimization & Preview Fixes - Product Requirements Document

## Overview
- **Summary**: Reorganize and expand the text settings panel in the batch creation form, fix text settings not appearing in the desktop preview, and eliminate color picker lag by implementing debounced state updates.
- **Purpose**: Improve the UX of customizing pin text appearance while creating batches. Users should see text style changes reflected instantly in the preview without noticeable lag when adjusting colors.
- **Target Users**: TechTreasure users creating Pinterest pin batches who want to customize text appearance (colors, bold/italic, backgrounds) per-batch without editing their saved brand.

## Goals
- Restructure text settings into a single organized, collapsible section with logical grouping (Brand Text, Headline Text, CTA Text).
- Add new text customization features: CTA color override, headline text color (separate from brand text color), text shadow toggle.
- Fix the desktop sticky preview so text settings (bold, italic, brandNameColor, textBgColor) are actually applied — currently only the mobile preview passes `textStyle`.
- Eliminate color picker lag via debounced state (≈100-150ms) so dragging the native color wheel does not trigger a full canvas re-render on every pixel.
- Ensure the preview updates reliably after debounce, showing both brand overrides (font/text_color/bg_color) and the batch PinTextStyle.

## Non-Goals
- No database schema changes — all settings remain batch-level in-memory overrides.
- No changes to the generated pin rendering pipeline beyond consuming new text style fields.
- No changes to BackgroundPicker, CSV/JSON import, or batch submission logic.
- No new UI framework or color-picker library swap.

## Background & Context
- The current BatchForm.tsx (lines 170-203) stores text style as a mix of `brandOverrides` (font, text_color, bg_color) and four standalone booleans/colors: `brandNameColor`, `textBold`, `textItalic`, `textBgEnabled`, `textBgColor`.
- The settings UI is spread across two disconnected grids (lines 875-920 and 943-1002) with no section heading, making them hard to discover.
- `PinPreview` accepts `textStyle` prop correctly and uses it in renderKey, but BatchForm's desktop sticky preview (line 1827) does not pass `textStyle` at all — this is a clear bug; the mobile layout (line 1808) does pass it.
- Color picker lag: native `<input type="color">` fires `onChange` on every shade change during drag. Each change updates React state, which triggers `textStyle` `useMemo` recomputation, which flows into `PinPreview.renderKey`, which triggers `renderPin()` (a 1000×1500 canvas + image load + Google fonts + toBlob → Blob → URL.createObjectURL — very expensive).

## Functional Requirements
- **FR-1 (Text section structure)**: All text-related controls (font, colors, bold/italic, backgrounds, shadows, CTA overrides) must live under one clearly-labeled section titled "Text & appearance" with a visual separator from the other cards. Controls within must be grouped: Brand bar (font, brand name color, logo area), Headline block (text color, bold, italic, backdrop color + toggle, shadow toggle), CTA pill (color override, bg color override, toggle).
- **FR-2 (Headline text color)**: Add a new `headlineTextColor` override (separate from `brand.text_color` and separate from `brandNameColor`). It controls only the big centered headline (and attribution color) in renderPin, falling back to `brand.text_color` when null.
- **FR-3 (CTA pill override)**: Add CTA-specific batch overrides: a toggle "Customize CTA" plus two color pickers (`ctaTextColor`, `ctaBgColor`) and a bold toggle (`ctaBold`). When toggled off, CTA uses brand defaults (brand.text_color on brand.bg_color, 600 weight). When on, the custom values are passed through PinTextStyle → renderPin.
- **FR-4 (Text shadow toggle)**: Add a `textShadowEnabled` toggle (default on) for the headline + brand name + attribution shadows. renderPin must skip `ctx.shadowBlur` / `ctx.shadowColor` when false.
- **FR-5 (Preview wired up)**: Both the mobile preview block and the desktop sticky preview must pass the fully-computed `textStyle` (including headlineTextColor, ctaXxx overrides, shadow flag) to `<PinPreview>`.
- **FR-6 (Color debounce)**: Every `<input type="color">` in BatchForm (text_color, bg_color, brandNameColor, headlineTextColor, textBgColor, ctaTextColor, ctaBgColor) and in BackgroundPicker (gradC1, gradC2) must update state via a shared debounce hook so that dragging the color wheel does not re-render the preview more than about 7 times per second. The final value on mouse-up/color-dialog close must be committed without additional delay.
- **FR-7 (Reset granularity)**: Keep the existing "Reset overrides" banner but split its button into a reset that clears brandOverrides + textStyle (current behavior), plus per-group reset mini-buttons in the new section (reset brand bar, reset headline, reset CTA).

## Non-Functional Requirements
- **NFR-1 (Perceived responsiveness)**: While dragging a color picker, the browser UI must remain responsive (no >50ms main-thread blocking per interaction) as measured by Chrome DevTools performance trace on a mid-range laptop.
- **NFR-2 (Preview latency)**: After releasing a color picker or toggling a checkbox, the preview image must reflect the change within 400ms (excluding network time for background image loads).
- **NFR-3 (Backwards compatible)**: Pins generated without touching the new controls must look identical to pins generated before this change (same defaults: headline color = brand.text_color, shadow = on, CTA = brand defaults).

## Constraints
- **Technical**: Must use only React state hooks (no Redux/Zustand migration). Debounce via a small custom `useDebouncedState` hook in `src/lib/` — no new npm dependencies. renderPin already consumes `options.textStyle`; extend PinTextStyle interface but keep all new fields optional so old call sites still work.
- **Business**: All overrides remain batch-scoped (not persisted to brands table). No impact on credits/billing.
- **Dependencies**: Depends on `src/lib/renderPin.ts` and `src/components/PinPreview.tsx` interfaces; keep them additive.

## Assumptions
- The native `<input type="color">` drag produces `input` events that fire more frequently than `change`. Debouncing the React state setter should be sufficient regardless of browser event cadence.
- Users expect bold/italic toggle to apply to headline + brand bar together (current behavior). We keep that convention; headline-only bolding is out of scope.
- CTA pill is small enough that a separate italic toggle is not needed.

## Acceptance Criteria

### AC-1: Single organized Text & appearance section
- **Type**: `rule`
- **Given**: A user opens the New batch page with at least one brand.
- **When**: They scroll through the left column of cards.
- **Then**: There is exactly one card (or clearly-grouped card region) titled "Text & appearance" containing every text-related control: font selector, brand text color, brand bg color, brand name color, headline text color, headline bold/italic, headline backdrop + color, text shadow toggle, and CTA customization group.
- **Pass Condition**: Visual inspection of the rendered form; all text controls located within the section with no text controls scattered in other cards.
- **Evidence**: Screenshot or DOM inspection of BatchForm section headings and control placement.

### AC-2: Headline text color works independently
- **Type**: `rule`
- **Given**: User is on New batch page.
- **When**: User sets headlineTextColor to e.g. `#ff0000` while leaving brand text_color at its default.
- **Then**: Preview updates to show big headline text in red while the brand name at the top keeps the default brand text_color.
- **Pass Condition**: renderPin draws headline `fillStyle` from headlineTextColor (fallback brand.text_color); brand name `fillStyle` from brandNameColor (fallback brand.text_color).
- **Evidence**: Preview screenshot with distinct brand-name vs headline colors; reading `ctx.fillStyle` assignments in renderPin around lines 286 and 360.

### AC-3: CTA pill customization
- **Type**: `rule`
- **Given**: Customize CTA toggle is enabled in Text & appearance.
- **When**: User picks a custom CTA text color (e.g. white) and CTA bg color (e.g. brand blue) and toggles CTA bold.
- **Then**: CTA pill in the preview renders with the custom colors and bold 700-weight font, overriding brand defaults. When the toggle is disabled, CTA returns to brand defaults instantly.
- **Pass Condition**: PinTextStyle carries `ctaTextColor`, `ctaBgColor`, `ctaBold`; renderPin applies them around lines 310-331.
- **Evidence**: Preview screenshot; renderPin source showing conditional branches for CTA overrides.

### AC-4: Desktop preview passes textStyle
- **Type**: `rule`
- **Given**: Viewport width >= 1024px so the sticky desktop preview column is active.
- **When**: User toggles "Bold" off or picks a brand name color.
- **Then**: The sticky preview immediately (after debounce) reflects the change — not just the mobile preview below.
- **Pass Condition**: BatchForm.tsx lines around 1823-1840 pass prop `textStyle={textStyle}` into the second `<PinPreview>` invocation.
- **Evidence**: JSX source of both PinPreview call sites; both include textStyle prop.

### AC-5: Color picker debounce removes lag
- **Type**: `rule`
- **Given**: New batch page open in a browser on a mid-range machine.
- **When**: The user drags within a native color picker (e.g. the "Text color" picker) continuously for 3 seconds.
- **Then**: The PinPreview canvas does not re-render on every mousemove pixel; at most 20-25 preview updates occur during the drag (≈7-8 fps), and the main thread remains free enough that scrolling / typing is not blocked. On release of the picker the final color appears in preview within one debounce interval + render time.
- **Pass Condition**: Debounce hook wrapping all color setter state; console.time logging in renderPin (temporary instrumentation in dev) shows <= ~24 calls over a 3s drag, versus >100 without debounce.
- **Evidence**: DevTools Performance recording snippet; useDebouncedState hook source code.

### AC-6: Shadow toggle removes text shadows
- **Type**: `rule`
- **Given**: Preview shows normal drop shadows.
- **When**: User turns off `textShadowEnabled` in Text & appearance.
- **Then**: Preview re-renders without the headline drop-shadow, brand name shadow, and attribution shadow. The CTA pill and readability gradient remain unaffected.
- **Pass Condition**: renderPin lines that set `ctx.shadowColor` / `ctx.shadowBlur` guard on the flag.
- **Evidence**: Preview screenshot (on and off side-by-side); source code guards in renderPin.

### AC-7: Layout quality of the text section
- **Type**: `rubric`
- **Dimension**: Visual organization and scannability of the Text & appearance section.
- **Scale**: 1-5
- **Anchors**: 1 = controls mixed randomly with other cards, no grouping. 3 = controls in one place but with inconsistent alignment, missing group headings. 5 = controls cleanly grouped (Brand bar / Headline / CTA) with subheadings, consistent 2-col grid on desktop, related controls (e.g. toggle + paired color) on same row, reset buttons per group aligned.
- **Pass Threshold**: >= 4
- **Evidence**: Screenshot of the form section evaluated against anchors.

## Open Questions
- [ ] Should CTA bold toggle also apply CTA italic? (Assumption: no, italic not commonly used for pill buttons.)
- [ ] Is 120ms debounce window suitable, or should it be user-tunable? (Default: 120ms for all color pickers.)
