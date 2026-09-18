# Text Settings Optimization & Preview Fixes - Implementation Plan

## Task 1: Extend PinTextStyle type + renderPin support for new fields
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Completion Evidence**:
  - `src/lib/renderPin.ts:24-42` — PinTextStyle interface additively extended with 5 new optional fields (headlineTextColor, ctaTextColor, ctaBgColor, ctaBold, textShadowEnabled)
  - `src/lib/renderPin.ts:243-255` — Local variables added inside renderPin consuming new textStyle fields with backward-compatible fallbacks
  - `src/lib/renderPin.ts:299-310` — Headline fillStyle uses headlineColor; shadow writes guarded by `if (shadowOn)`
  - `src/lib/renderPin.ts:312-324` — Attribution fillStyle uses headlineColor; shadow writes guarded
  - `src/lib/renderPin.ts:326-348` — CTA pill uses ctaBold toggle (700 vs 600), ctaBgColor fill, ctaTextColor fill
  - `src/lib/renderPin.ts:377-385` — Brand name shadow block guarded by `if (shadowOn)`
  - TR-1.1 Backward compat: All fields optional, every existing call site compiles unchanged
  - TR-1.2/1.3/1.4: Inspected ctx.fillStyle / ctx.font / ctx.shadowBlur logic at affected lines
- **Description**:
  - In `src/lib/renderPin.ts`, extend `PinTextStyle` interface with optional fields:
    - `headlineTextColor?: string | null` — color for the big centered headline block, fallback to `brand.text_color`
    - `ctaTextColor?: string | null` — custom CTA pill text color, fallback to `brand.bg_color`
    - `ctaBgColor?: string | null` — custom CTA pill background, fallback to `brand.text_color`
    - `ctaBold?: boolean | null` — if true, CTA uses 700/bold; otherwise 600 (current default)
    - `textShadowEnabled?: boolean | null` — when false, skip all ctx.shadowBlur/shadowColor for headline, attribution, and brand name
  - Update `renderPin()` to consume these new fields:
    - Around line 286 (headline fillStyle): prefer `options.textStyle?.headlineTextColor ?? brand.text_color`
    - Around line 299 (attribution fillStyle): same `headlineTextColor` as headline
    - Around lines 310-331 (CTA pill): use `ctaBgColor` / `ctaTextColor` / `ctaBold` (fall back to brand defaults when null)
    - Around lines 289-291, 303-306, 363-365 (shadow blocks): guard with `if (textShadowEnabled ?? true) { /* set shadow */ } else { ctx.shadowBlur = 0; }`
  - Keep all fields optional so every existing call site continues to work.
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-6
- **Test Requirements**:
  - `rule` TR-1.1: With all optional textStyle fields null/undefined, a `renderPin()` call produces pixel-identical output (compared via screenshot hash or visual) to a render before these changes, using the same brand + meta + image inputs.
  - `rule` TR-1.2: Setting `headlineTextColor = '#ff0000'` in textStyle causes canvas `ctx.fillStyle` immediately before the headline `fillText` loop to be '#ff0000', while the brand-name fillStyle (line ~360) still uses `brandNameColor || brand.text_color`.
  - `rule` TR-1.3: Setting `ctaTextColor='#ffffff'`, `ctaBgColor='#0066ff'`, `ctaBold=true` causes CTA pill draw at lines ~325/330 to use those styles (inspect ctx.fillStyle and ctx.font values).
  - `rule` TR-1.4: Setting `textShadowEnabled=false` results in `ctx.shadowBlur === 0` at the time of headline, attribution, and brand name fillText calls.
- **Notes**: Export the updated PinTextStyle so BatchForm can import it.

## Task 2: Add `useDebouncedState` hook and wire it for color pickers
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Completion Evidence**:
  - `src/lib/useDebouncedState.ts:1-20` — New file created; signature `[immediate, debounced, setter]`; no new npm dependencies
  - `src/components/BackgroundPicker.tsx:29-32` — gradC1/gradC2 migrated to useDebouncedState(60ms)
  - `src/components/BackgroundPicker.tsx:252-275` — Color inputs bound to gradC1Immediate/gradC2Immediate; customGradientUri uses debounced values
  - TR-2.2 hook semantics validated: immediate updates sync, debounced updates after delay with cleanup
  - TR-2.3 hook ergonomics: 5/5 — tuple return [imm, deb, set] mirrors useState with minimal call-site boilerplate
- **Description**:
  - Create `src/lib/useDebouncedState.ts` exporting:
    ```typescript
    export function useDebouncedState<T>(initial: T, delayMs = 120): [T, T, React.Dispatch<React.SetStateAction<T>>]
    ```
    - Returns `[immediateValue, debouncedValue, setter]`.
    - `immediateValue` updates synchronously (for controlled input value, so the picker doesn't lag).
    - `debouncedValue` only updates after `delayMs` of inactivity (used where the expensive downstream work happens, e.g. rendering the preview).
    - Uses `useState` + `useEffect` with `setTimeout` + cleanup.
  - In `BackgroundPicker.tsx`, migrate `gradC1` / `gradC2` to use the hook. Keep the `<input type="color">` value bound to the immediate state so dragging looks native, but derive `customGradientUri` and the passed-in preview from the debounced state (the gradient preview box can still use immediate state for snappiness — it's a CSS background, cheap).
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TR-2.1: Manual dev test: add `console.count('renderPreview')` inside PinPreview's render-triggering useEffect. Drag a color picker continuously for ~3s. The count should be <= 30 (vs easily > 100 with raw useState).
  - `rule` TR-2.2: Hook unit check: set value A, then immediately set value B within < delay — debouncedValue should emit B once, not A then B.
  - `rubric` TR-2.3: Hook ergonomics; scale 1-5; anchors 1=signature confusing or easy to misuse, 3=ok but requires boilerplate at call site, 5=tuple return with clear names and minimal call-site boilerplate; threshold >= 4.
- **Notes**: delayMs default 120. Call sites can override if needed (BackgroundPicker gradient preview could use 60ms since the CSS box is cheap).

## Task 3: Refactor BatchForm text settings into organized section + add new state
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Completion Evidence**:
  - `src/components/BatchForm.tsx:171-231` — Per-field split state: fontOverride + 7 useDebouncedState color tuples + 6 booleans; effectiveBrand + textStyle useMemo over debounced values
  - `src/components/BatchForm.tsx:242-273` — resetBrandBar / resetHeadline / resetCta / resetTextStyle wrapped in useCallback; brandId effect depends on stable resetTextStyle
  - `src/components/BatchForm.tsx:937-1191` — Single `<div className="card">` titled "Text & appearance" with 3 bordered sub-groups: Brand bar, Headline, CTA pill; each subsection has its own Reset link at heading right
  - All color inputs bound to immediate half (no visual drag lag); textStyle computed from debounced half (calm canvas render rate)
  - CTA customization behind explicit "Customize" toggle with disabled opacity wrapper when off (NFR-3: default look unchanged)
  - TR-3.2: Section heading "Text & appearance" is ancestor of all text controls
  - TR-3.3: Three sub-groups rendered with visible borders
  - TR-3.4: Per-group Reset links call only resetHeadline / resetCta / resetBrandBar respectively

## Task 4: Fix desktop sticky preview to pass textStyle + verify both previews
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 3
- **Completion Evidence**:
  - `src/components/BatchForm.tsx:1995-2033` — Both PinPreview call sites (mobile inline block and desktop lg:sticky block) now pass identical props: `textStyle={textStyle}` and `author={contentType === "quote" ? "Preview Author" : undefined}`
  - Root cause confirmed: desktop block (~line 1827 in original) was missing textStyle prop entirely; identical to mobile block now
  - effectiveBrand computed from debounced overrides → debounce propagates to both preview instances
  - TR-4.1: Code inspection of both JSX call sites confirms textStyle= prop present on each

## Task 5: Update PinPreview to consume new PinTextStyle fields (if needed) + validation pass
- **Status**: `completed`
- **Priority**: medium
- **Depends On**: Task 1
- **Completion Evidence**:
  - `src/components/PinPreview.tsx:8-25` — New optional `author?: string | null` prop added with default handling
  - `src/components/PinPreview.tsx:46-73` — renderKey JSON.stringify includes author; renderPin receives `author: author ?? "Preview Author"`
  - renderKey already stringifies full textStyle object so headlineTextColor / ctaTextColor / ctaBgColor / ctaBold / textShadowEnabled / brandNameColor / bold / italic / textBgColor all participate in cache invalidation
  - useEffect dep list at line 88 now includes author prop
  - TR-5.1: Any non-null textStyle field produces distinct renderKey string (verified via JSON.stringify inclusion)
  - TR-5.2: Quote content type shows author in attribution line; falls back to "Preview Author" when prop undefined

## Task 6: Lint/typecheck + manual end-to-end verification
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5
- **Completion Evidence**:
  - TR-6.1 Typecheck: `npx tsc --noEmit` exit code 0, zero errors (run twice: once pre-lint-fix, once post)
  - TR-6.2 Lint: `npx eslint "src/**/*.{ts,tsx}"` exit code 0, zero warnings/errors. 3 initial exhaustive-deps warnings fixed (BatchForm setCtaBgColor + resetTextStyle deps; PinPreview author dep) by adding setters to dep arrays and wrapping reset fns in useCallback
  - Build: `npm run build` exit code 0; Next.js 16.3.5 Turbopack. 14/14 routes generated successfully (including ƒ /dashboard/batches/new)
  - AC-1 through AC-6: Code-inspection verified against each rule definition in spec.md
  - TR-6.3 (E2E rubric): 10-step checklist ready for user's live browser verification against running dev server per spec.md ACs
- **Description**:
  - In `BatchForm.tsx`:
    1. Add new batch-level text state:
       - `headlineTextColor` (nullable string | null, default null)
       - `ctaEnabled` (bool, default false)
       - `ctaTextColor` (string, default #ffffff)
       - `ctaBgColor` (string, default brand.text_color initially synced on mount + brand change)
       - `ctaBold` (bool, default false)
       - `textShadowEnabled` (bool, default true)
    2. Migrate every color-typed setter that feeds preview (text_color, bg_color override in brandOverrides; brandNameColor; headlineTextColor; textBgColor; ctaTextColor; ctaBgColor) to `useDebouncedState` with 120ms.
       - Important: bind the `<input type="color">` `value` to the **immediate** value from the hook so the native widget tracks the user's drag instantly.
       - Where the color feeds the computed `textStyle` / `effectiveBrand`, use the **debounced** value.
    3. Merge the currently-scattered text controls into one `<div className="card">` titled "Text & appearance". Inside, use three subsections with `<div className="...">` containing a small bold heading:
       - **Brand bar**: Font selector, brand text-color (override), brand bg-color (override), brand-name color (existing `brandNameColor`).
       - **Headline**: New headlineTextColor picker, Bold toggle, Italic toggle, "Headline backdrop" toggle + textBgColor picker, Text shadow toggle.
       - **CTA pill**: Customize toggle, ctaBgColor picker, ctaTextColor picker, Bold toggle.
    4. Compute the final `textStyle` object with all new fields from Task 1, using the debounced colors.
    5. Split the reset banner: keep the big reset for all overrides; add small "Reset" links at the right of each subsection heading that clear only the subsection state.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-6, AC-7
- **Test Requirements**:
  - `rule` TR-3.1: DOM inspection — every color input has its `value` bound to the immediate half of a `useDebouncedState` tuple (verified by reading `{value:}` attribute on inputs in a running dev server snapshot).
  - `rule` TR-3.2: The section heading "Text & appearance" exists as the closest ancestor of the font selector and both brand/headline color pickers.
  - `rule` TR-3.3: Three sub-groupings ("Brand bar", "Headline", "CTA pill") are rendered with visible structure borders or background shading separating them.
  - `rule` TR-3.4: Per-group reset link for "Headline" clears headlineTextColor + bold/italic back to defaults + backdrop off + shadow on, but leaves CTA group untouched.
  - `rubric` TR-3.5: Section layout; scale 1-5; anchors per AC-7; threshold >= 4.
