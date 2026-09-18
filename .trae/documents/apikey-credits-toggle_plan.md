# API Key Wording + Use Account Credits Toggle Implementation Plan

## Repository Research

### Current architecture
- **`profiles` table (Supabase)**: Each user has one row. Columns relevant here: `credits int`, `ai_credits int`, `gemini_api_key text nullable`. Existing profile RLS: user can select/update only their own row.
- **`unlimited` derivation**: In `src/app/dashboard/batches/new/page.tsx` line 43, the server page passes `unlimited={!!profile?.gemini_api_key}` purely as a function of whether the user saved their own API key. There is currently **no way to opt out** of using the personal key while keeping it saved.
- **Text/UI using "Unlimited"**: 5 distinct places use the word:
  1. **BatchForm credit banner** (line ~1717): green pill "Unlimited generation — your own Gemini key is active. No credits will be spent." with infinity icon.
  2. **BatchForm confirm modal** (line ~1924): `unlimited ? "Unlimited" : aiCredits - items.length` for AI credits after, same pattern for pin credits after.
  3. **GeminiKeyForm success toast** (line 39): "API key saved. Unlimited generation is now on."
  4. **GeminiKeyForm status banner** (line 66-67): "Your own key is active (••••ABCD). Pins generate unlimited and don't spend credits."
  5. **Settings page Account card** (lines 37, 57, 63): Description "unlimited pins" + both AI credits and Pin credits show `key ? "Unlimited" : N`.
- **API key call sites in generation**: `BatchForm.tsx` uses `unlimited` as a gating boolean at 7 points to skip credit pre-checks (`!unlimited && credits < items.length`), skip credit DB spending, and skip shared-key rate-limit handling. The actual Gemini call endpoint (`generate-meta` edge function) will use the user's personal key vs shared key based on `profiles.gemini_api_key` presence server-side — so treating the user as "not unlimited" on the client **will correctly spend credits but will still route through their saved personal key unless generate-meta receives a signal**. Need to check generate-meta.

### Generate-meta key routing check
Before planning, verify: does the edge function `generate-meta` already accept a "force shared key even if user has own" signal? If not, we need to pass a new optional flag, e.g. `forceSharedKey=true`, and have the server honor it by **not** reading `profiles.gemini_api_key` for that call, using shared pool instead. Because the user explicitly choosing "Use account credits" means they want to preserve their Google AI Studio quota (which comes out of their saved key).

### User requirement parsing (two distinct asks)
1. **Wording change**: Everywhere that currently says "Unlimited…" when a user has saved their own key → change to **"🔑 API key being used"** (exact phrase per user request). The word "Unlimited" should no longer appear as a status label. Save success text and Settings description text also change away from "unlimited".
2. **New feature**: Even when the user **has** saved a personal `gemini_api_key`, add a toggle/option to **"Use account credits"** instead. When this toggle is ON:
   - Generation should **behave as if `gemini_api_key` were null** for that request: credits are spent normally, shared server keys are used (not the user's personal Google quota).
   - The toggle should persist across visits — stored as a new nullable boolean profile column `prefer_credits_with_key boolean not null default false`.
   - When toggled OFF: use the personal key (original behavior), status shows "API key being used", no credits spent.

---

## Files and Modules
- `supabase/schema.sql`: Add `prefer_credits_with_key boolean not null default false` column to `profiles` table; add rollout `alter table` comment for existing deployments.
- `src/lib/profileCredits.ts`: Include `prefer_credits_with_key` in `ProfileBalances` interface + SELECT list + normalize fallback.
- `src/components/GeminiKeyForm.tsx`:
  - Change "unlimited" wording in save-success toast, status banner line.
  - Add a toggle sub-component **only when `hasKey === true`**: "Prefer account credits (don't use my personal key)" that writes the new boolean column via `profiles.update`.
- `src/app/dashboard/settings/page.tsx`:
  - Change all "Unlimited" labels to display:
    - When key present AND `prefer_credits_with_key=false` → "🔑 API key in use"
    - When key present AND `prefer_credits_with_key=true` → show numeric credit balances (same as no-key)
    - When key absent → same numeric as today
  - Rewrite the section description copy to remove "unlimited".
- `src/app/dashboard/batches/new/page.tsx`:
  - Read new `prefer_credits_with_key` column from profile SELECT.
  - Change `unlimited` prop: should now be `unlimited = hasKey && !prefer_creditsWithKey` (instead of just `!!gemini_api_key`). This is the **single source of truth** for the "use personal key" behavior in BatchForm.
  - Additionally pass two raw booleans: `hasApiKey: boolean` and `preferCreditsInitial: boolean` so BatchForm can render a toggle UI even when `unlimited=false`.
- `src/components/BatchForm.tsx`:
  - Update Props interface to accept `hasApiKey?: boolean` and `initialPreferCredits?: boolean`; add state `preferCredits` with setter + `router.refresh`-style profile update on change (writes the boolean column back).
  - Banner copy (line ~1717): replace "Unlimited generation —..." green pill → two branches:
    - `hasApiKey && !preferCredits` → 🔑 **API key being used.** Your personal Google Gemini quota is being consumed directly. No credits will be spent.
    - `hasApiKey && preferCredits` → (gray pill) **Using account credits.** Your saved key is present but bypassed for this session.
    - Else → numeric credits (unchanged).
    - AND: insert a small inline toggle next to the banner status (only when hasApiKey) → "Use account credits instead" checkbox bound to state.
  - Confirm modal (lines ~1924/1928): change the `unlimited ? "Unlimited"` branch to read `(hasApiKey && !preferCredits) ? "API key" : N`, or better, always show numeric credits since the user may have the key present but be in prefer-credits mode — when key mode show "API key (not applicable)" or continue showing numeric but suffix with "not spent". Simplest behavior: **in prefer-credits mode show actual subtraction from real balances; in API-key mode show the numeric balances plus "API key — credits not spent."**
  - All 7 `if (!unlimited)` gating checks remain correct as-is because `unlimited` prop now correctly collapses to `false` whenever `preferCredits=true`, triggering the spend paths.
- `supabase/functions/generate-meta/index.ts` (edge function): Add optional body parameter `preferSharedKey?: boolean`. When `true`, skip reading `profiles.gemini_api_key` from the profile regardless of its presence; use shared env key pool. This is what actually preserves the user's personal Google quota when they check "Use account credits".
- `BatchForm.tsx` generate-meta caller: When `preferCredits === true` and we do call the AI, pass `preferSharedKey: true` in the fetch body to the edge function.

---

## Implementation Steps (dependency order)
1. **Schema + ProfileBalances**: Add the column in `schema.sql` with rollout comment; extend `ProfileBalances` interface, getProfileBalances SELECT, and normalize() fallback in `profileCredits.ts`. (no backend dependency → safe to do first)
2. **Edge function signal check & update**: Read `generate-meta/index.ts`. If it uses the user's `gemini_api_key` in all cases when present, add the `preferSharedKey` branch to bypass it. If already handled, skip the body addition but keep signal for clarity.
3. **Settings + GeminiKeyForm UI**: Rewrite all "unlimited" copy per rules above; add the "Prefer account credits" toggle in GeminiKeyForm (only when hasKey) writing the new boolean column; update Settings page Account card credit display to honor the flag.
4. **New batch page props**: Modify `batches/new/page.tsx` to read `prefer_credits_with_key`; compute `unlimited = hasKey && !preferCreditsWithKey`; pass new props `hasApiKey` and `initialPreferCredits` into BatchForm.
5. **BatchForm UI changes**:
   - Expand Props, add `preferCredits` useState + server-side setter function that writes to Supabase and re-reads state.
   - Rewrite the bottom credit banner (3 branches + inline toggle when eligible).
   - Rewrite confirm modal credit summary to show real numbers in prefer-credits mode, "API key (credits not spent)" in key mode.
   - At the `generate-meta` fetch call site, include `preferSharedKey: preferCredits` in the JSON payload when calling the AI.
   - Do NOT touch any of the `if (!unlimited)` gating branches — their behavior is correct via the changed prop value.
6. **Verification**: Run typecheck → lint → build → then manual browser run.

---

## Dependencies and Considerations
- **Edge function update is required**: Without the `preferSharedKey` signal, user's personal Google quota will still be consumed even when `preferCredits=true` — despite the client spending credits. This would be a misleading UX and the core of the new feature would be broken.
- **Existing `unlimited` gating is re-used**: The 7 existing credit gates (`!unlimited`) automatically trigger correctly after step 4 because `unlimited` collapses to false when preferCredits is on. No logic duplication required.
- **Schema rollout for existing deployments**: Need to include the usual `alter table … if not exists` comment block (same pattern as `ai_credits` on schema.sql line 31-33) so operators can run a one-off SQL in Supabase SQL Editor. Column default `false` → existing users with keys default to the original behavior (personal key = "API key being used"), no unexpected credit spending after deploy.
- **No new NPM deps**: All UI uses native `<input type="checkbox">` / existing `label`/`card` class patterns.
- **Backwards compat on profile SELECT**: profileCredits.ts normalize() fallback already handles unknown columns — if someone hasn't run the SQL migration yet, `prefer_credits_with_key` safely falls back to `false` (no behavior change).

---

## Validation
1. `npx tsc --noEmit` → exit 0.
2. `npx eslint "src/**/*.{ts,tsx}"` → 0 warnings/errors.
3. `npm run build` → 14/14 routes generated.
4. Manual checklist (5 steps):
   - Step A (no key): Page renders numeric credits; toggle does not appear. No word "Unlimited" anywhere.
   - Step B (key saved, toggle OFF): Banner shows 🔑 "API key being used". Confirm modal says "API key" not "Unlimited". Settings Account card shows "🔑 API key in use" — no word "Unlimited". Word count of "unlimited" across the app should be 0.
   - Step C (key saved, toggle ON): Banner switches to "Using account credits". Pre-checks fail correctly when credits < items; real credits are spent on run; and confirm show real subtraction.
   - Step D (toggle persistence): Refresh `/dashboard/batches/new` after toggling ON → setting survives refresh (confirmed reading back from profile column).
   - Step E (generate-meta signal): With hasKey + preferCredits on, run one pin with-AI mode; in edge function logs verify shared key path was taken (or temporarily console.log `usingSharedKey` to verify). No credits silently double-spent: credit decrement count in DB matches successful pins.

---

## Risks
- **Risk R1: Missing `preferSharedKey` signal causes double-charge semantics**: User spends credits AND still uses their personal key. **Handling**: Make step 2 (edge function update) a required step; do not skip.
- **Risk R2: Forget fallback for missing column → crash on undeployed DBs**: **Handling**: profileCredits.ts normalize() always provides `?? false` for the new boolean; SELECT without the new column falls back to basic re-select path exactly as before (as it already does for `ai_credits`).
- **Risk R3: "Unlimited" label bleeds in copy-paste places**: **Handling**: grep `src/ supabase/` for case-insensitive `unlimited` after edits; ensure only expected references (like old SQL comments or user-facing guides outside UI) remain.
- **Risk R4: Edge function deploy step needed separately from UI**: **Handling**: Note in summary — the edge function must be deployed via `supabase functions deploy generate-meta` for the feature to fully work. The UI will behave correctly immediately but without the deploy, step C still consumes the user's personal Google quota despite spending credits.
