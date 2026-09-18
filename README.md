# TechTreasure

Bulk Pinterest Pin Generator + monetized redirector. Built from the PRD:
Next.js 14 (App Router, TypeScript, `src/`), Tailwind, Supabase (Auth +
Postgres/RLS + Storage + Edge Functions), Google Gemini 1.5 Flash, papaparse,
and client-side HTML5 Canvas rendering (1000×1500 PNG).

## Local development

```bash
cp .env.example .env.local   # then fill in the values below
npm install
npm run dev                  # http://localhost:3000
```

## Setup (one time)

### 1. Supabase project
Create a project at supabase.com, then:

- **Schema** — open the SQL Editor and run the whole of
  [`supabase/schema.sql`](supabase/schema.sql). It creates the tables
  (`profiles`, `brands`, `batches`, `pins`, `redirects`), enables RLS, adds the
  `handle_new_user()` trigger (auto-creates a `free` profile with 20 credits on
  signup), and creates the three public storage buckets (`logos`, `backgrounds`,
  `rendered-pins`) with their policies.

- **Auth** — Authentication → Providers → Email: enable it. With "Confirm email"
  on, users verify via a link that returns to `/auth/callback`.

### 2. Environment variables (`.env.local`)
| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (server only) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; `https://techtreasure.sbs` in prod |
| `GEMINI_API_KEY_1..3` | 3 keys from Google AI Studio (rotated on rate-limit) |

Razorpay billing uses the server-only variables in `.env.example`: set the
Razorpay key ID/secret, webhook secret, and the three monthly Plan IDs. Plan
prices and pin-credit amounts are centralized in `src/lib/plans.ts`, so change
those constants there when the commercial values change. The public pricing
page is `/pricing`. Configure Razorpay webhooks to POST to
`/api/razorpay/webhook` for subscription activation, renewal, and cancellation.
The ₹9 lifetime trial is verified at `/api/razorpay/verify-trial` and is guarded
once per account in `trial_redemptions`.

### 3. Edge functions
Deploy the two Deno functions from the Supabase CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
# Set the secrets the functions read:
supabase secrets set GEMINI_API_KEY_1=... GEMINI_API_KEY_2=... GEMINI_API_KEY_3=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...   # used by track-click
supabase functions deploy generate-meta
supabase functions deploy track-click
```

### 4. Redirector ads
[`public/redirector.html`](public/redirector.html) is a standalone page. Paste
each ad provider script in the matching loader in that file. To turn ads on or
off independently, edit the named booleans near the top of the file:

- `ad1_inPagePush`
- `ad2_pushNotifications`
- `ad3_vignetteBanner`
- `ad4_socialBanner`
- `ad5_sideBanner`
- `ad6_topBanner`
- `ad7_nativeBanner`

Set any value to `true` or `false`. To enable click tracking, set `TRACK_CLICK_URL` in that file to your
`track-click` function URL (`https://<ref>.supabase.co/functions/v1/track-click`).

## How it works
1. **Sign up** → Supabase trigger creates a `free` profile with 20 credits.
2. **Create a brand** → logo, text/bg colors, font.
3. **New batch** → pick brand, board, source link, content type (`news`/`quote`/`fact`),
   language, input mode (topic or paste list), start datetime + interval, and
   background image URLs. Clicking **Generate** loops each item:
   `generate-meta` (Gemini) → canvas render → upload to `rendered-pins` →
   insert `pins` row → deduct 1 credit (refunded on any error).
4. **Export CSV** → client builds a Pinterest-ready CSV (papaparse). Every `Link`
   points to `/redirector.html?url=<encoded source_link>`; `Publish date` is
   `start + index × interval` in UTC.
5. **Redirector** → shows ads, then forwards to the real destination on click.

## Notes & deviations from the PRD
- **Next.js version**: bumped to the latest patched `14.2.x` (14.2.35). The PRD
  locks "Next.js 14"; npm flagged `14.2.15` with a security advisory, so the
  patch release is used while staying on 14.
- **AI availability**: AI credits are currently marked Coming soon. AI
  generation is blocked unless the user adds their own Gemini API key in
  Settings; shared server keys are not used.
- **Topic mode**: the `generate-meta` contract returns one meta object per call,
  so topic mode issues one call per pin (idea *i of N*), consuming 1 credit each —
  matching "for each item, call generate-meta" and "deduct 1 credit per AI call".
- **Stripe / plans**: schema carries `plan` (`free`/`pro`/`business`) and
  `credits`; billing UI is intentionally stubbed (a v1 non-goal).
- The PRD file provided was truncated mid-schema; `brands`, `batches`, `pins`,
  and `redirects` columns were reconstructed from the user flows in sections 5.2–5.5.

## Deploy
Push to GitHub → import in Vercel → set the same env vars → point
`techtreasure.sbs` at Vercel. Storage/DB/functions live in Supabase.
