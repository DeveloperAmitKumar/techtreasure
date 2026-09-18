-- TechTreasure — Supabase schema (hardened)
-- Run in Supabase SQL Editor (Dashboard → SQL → New query), or apply via MCP.
--
-- Security notes applied here (per Supabase best practices):
--   * Explicit GRANTs so tables are reachable via the Data API (tables created
--     after 2026-04-28 are NOT auto-exposed to PostgREST).
--   * RLS on every table, policies scoped `to authenticated` with an ownership
--     predicate using the optimized `(select auth.uid())` form.
--   * UPDATE policies carry both USING and WITH CHECK (prevents row reassignment).
--   * The SECURITY DEFINER trigger function has EXECUTE revoked from public roles.
--   * Storage policies grant INSERT + SELECT + UPDATE + DELETE so upserts work.

-- ============================================================
-- 0. Data API exposure (schema usage + table privileges)
-- ============================================================
grant usage on schema public to anon, authenticated;

-- ============================================================
-- 1. profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free','pro','pro_plus','pro_max')),
  credits int not null default 20 check (credits >= 0),
  ai_credits int not null default 0 check (ai_credits >= 0),
  language text not null default 'en',
  gemini_api_key text,
  use_custom_gemini_key boolean not null default true,
  credits_reset_at timestamptz not null default now(),
  razorpay_subscription_id text,
  pending_plan text,
  created_at timestamptz not null default now()
);
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('free','pro','pro_plus','pro_max'));
alter table public.profiles add column if not exists credits_reset_at timestamptz not null default now();
alter table public.profiles add column if not exists razorpay_subscription_id text;
alter table public.profiles add column if not exists pending_plan text;
update public.profiles set ai_credits = 0 where ai_credits is null;
-- Split-credits rollout (run once on existing projects):
-- alter table public.profiles
--   add column if not exists ai_credits int not null default 20 check (ai_credits >= 0);
-- Custom Gemini key toggle rollout (run once on existing projects):
-- alter table public.profiles
--   add column if not exists use_custom_gemini_key boolean not null default true;

grant select, insert, update, delete on public.profiles to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- User questions, bug reports, complaints, billing issues, and suggestions.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  type text not null check (type in ('bug','complaint','question','billing','suggestion')),
  subject text not null check (char_length(subject) between 1 and 160),
  message text not null check (char_length(message) between 1 and 5000),
  page_url text,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert on public.reports to authenticated;
alter table public.reports enable row level security;
drop policy if exists "reports: select own" on public.reports;
create policy "reports: select own" on public.reports
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "reports: insert own" on public.reports;
create policy "reports: insert own" on public.reports
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Auto-create a profile row on signup. SECURITY DEFINER is required because the
-- trigger fires on auth.users (a restricted schema) and writes to public.profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, plan, credits, ai_credits, language, use_custom_gemini_key)
  values (new.id, new.email, 'free', 20, 0, 'en', true)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Do not let anon/authenticated call the definer function directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. brands
-- ============================================================
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  logo_url text,
  icon_name text default 'fluent-emoji-flat:glowing-star',
  text_color text not null default '#ffffff',
  bg_color text not null default '#e60023',
  font text not null default 'Georgia, serif',
  created_at timestamptz not null default now()
);
alter table public.brands add column if not exists icon_name text default 'fluent-emoji-flat:glowing-star';

grant select, insert, update, delete on public.brands to authenticated;

alter table public.brands enable row level security;

drop policy if exists "brands: select own" on public.brands;
create policy "brands: select own" on public.brands
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "brands: insert own" on public.brands;
create policy "brands: insert own" on public.brands
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "brands: update own" on public.brands;
create policy "brands: update own" on public.brands
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "brands: delete own" on public.brands;
create policy "brands: delete own" on public.brands
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ============================================================
-- 3. saved_boards
-- ============================================================
create table if not exists public.saved_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  pinterest_url text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.saved_boards to authenticated;

alter table public.saved_boards enable row level security;

drop policy if exists "saved_boards: select own" on public.saved_boards;
create policy "saved_boards: select own" on public.saved_boards
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "saved_boards: insert own" on public.saved_boards;
create policy "saved_boards: insert own" on public.saved_boards
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "saved_boards: update own" on public.saved_boards;
create policy "saved_boards: update own" on public.saved_boards
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "saved_boards: delete own" on public.saved_boards;
create policy "saved_boards: delete own" on public.saved_boards
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ============================================================
-- 4. batches
-- ============================================================
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  board_name text not null,
  source_link text not null,
  content_type text not null check (content_type in ('news','quote','fact')),
  language text not null default 'en',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.batches to authenticated;

alter table public.batches enable row level security;

drop policy if exists "batches: select own" on public.batches;
create policy "batches: select own" on public.batches
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "batches: insert own" on public.batches;
create policy "batches: insert own" on public.batches
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "batches: update own" on public.batches;
create policy "batches: update own" on public.batches
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "batches: delete own" on public.batches;
create policy "batches: delete own" on public.batches
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ============================================================
-- 4. pins
-- ============================================================
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  title text not null,
  description text not null,
  tags text[] not null default '{}',
  main_line text not null default '',
  cta text not null default '',
  image_url text not null,
  source_link text,
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists pins_batch_id_idx on public.pins (batch_id);

grant select, insert, update, delete on public.pins to authenticated;

alter table public.pins enable row level security;

drop policy if exists "pins: select own" on public.pins;
create policy "pins: select own" on public.pins
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "pins: insert own" on public.pins;
create policy "pins: insert own" on public.pins
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "pins: update own" on public.pins;
create policy "pins: update own" on public.pins
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "pins: delete own" on public.pins;
create policy "pins: delete own" on public.pins
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ============================================================
-- 5. redirects
-- ============================================================
-- Written by the track-click edge function using the service_role key (bypasses
-- RLS). Owner-facing reads are still RLS-scoped for the dashboard.
create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  source_link text not null,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists redirects_source_link_idx on public.redirects (source_link);

grant select, insert, update, delete on public.redirects to authenticated;

alter table public.redirects enable row level security;

drop policy if exists "redirects: select own" on public.redirects;
create policy "redirects: select own" on public.redirects
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "redirects: insert own" on public.redirects;
create policy "redirects: insert own" on public.redirects
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- One-time Razorpay trial redemption. Service-role webhook/verification writes;
-- authenticated users do not need direct table access.
create table if not exists public.trial_redemptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  razorpay_order_id text not null unique,
  razorpay_payment_id text not null unique,
  credits_granted int not null default 1000,
  created_at timestamptz not null default now()
);
alter table public.trial_redemptions enable row level security;

-- ============================================================
-- 6. Storage buckets (public) + policies
-- ============================================================
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('backgrounds', 'backgrounds', true)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('rendered-pins', 'rendered-pins', true)
on conflict (id) do nothing;

-- Each bucket: users manage objects under a folder named by their own uid.
-- Upsert needs INSERT + SELECT + UPDATE, so all four verbs are granted.
do $$
declare
  b text;
begin
  foreach b in array array['logos','backgrounds','rendered-pins'] loop
    execute format('drop policy if exists "%s: own write" on storage.objects', b);
    execute format('drop policy if exists "%s: own update" on storage.objects', b);
    execute format('drop policy if exists "%s: own delete" on storage.objects', b);
    execute format('drop policy if exists "%s: public read" on storage.objects', b);

    execute format($f$
      create policy "%s: own write" on storage.objects
        for insert to authenticated
        with check (bucket_id = '%s' and (storage.foldername(name))[1] = (select auth.uid())::text)
    $f$, b, b);

    execute format($f$
      create policy "%s: own update" on storage.objects
        for update to authenticated
        using (bucket_id = '%s' and (storage.foldername(name))[1] = (select auth.uid())::text)
        with check (bucket_id = '%s' and (storage.foldername(name))[1] = (select auth.uid())::text)
    $f$, b, b, b);

    execute format($f$
      create policy "%s: own delete" on storage.objects
        for delete to authenticated
        using (bucket_id = '%s' and (storage.foldername(name))[1] = (select auth.uid())::text)
    $f$, b, b);

    execute format($f$
      create policy "%s: public read" on storage.objects
        for select using (bucket_id = '%s')
    $f$, b, b);
  end loop;
end $$;
