-- ─────────────────────────────────────────────────────────────────────────────
-- Personal Dashboard 2.0 — Macro Pulse Module Schema
-- Run this in your Supabase project → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── macro_cache ───────────────────────────────────────────────────────────────
-- Server-side cache for FRED and Finnhub economic data.
create table if not exists public.macro_cache (
  cache_key   text        primary key,
  data        jsonb       not null,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- ── macro_notification_preferences ────────────────────────────────────────────
create table if not exists public.macro_notification_preferences (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  cpi_release   boolean     not null default true,
  fed_decision  boolean     not null default true,
  gdp_release   boolean     not null default false,
  jobs_report   boolean     not null default true,
  pce_release   boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id)
);

-- ── macro_sent_notifications ──────────────────────────────────────────────────
-- Deduplication log — prevents sending the same notification twice.
create table if not exists public.macro_sent_notifications (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  event_date        date        not null,
  notification_type text        not null check (notification_type in ('cpi_release', 'fed_decision', 'gdp_release', 'jobs_report', 'pce_release')),
  sent_at           timestamptz not null default now()
);

create unique index if not exists macro_sent_notif_dedup_idx
  on public.macro_sent_notifications(user_id, event_date, notification_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.macro_cache                      enable row level security;
alter table public.macro_notification_preferences   enable row level security;
alter table public.macro_sent_notifications         enable row level security;

-- macro_cache: public read, service role writes
create policy "Public can read macro_cache"
  on public.macro_cache for select using (true);

create policy "Service role can upsert macro_cache"
  on public.macro_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- macro_notification_preferences: users manage their own row
create policy "Users can read own macro prefs"
  on public.macro_notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own macro prefs"
  on public.macro_notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own macro prefs"
  on public.macro_notification_preferences for update
  using (auth.uid() = user_id);

-- macro_sent_notifications: service role writes, users read their own
create policy "Users can read own macro sent notifications"
  on public.macro_sent_notifications for select
  using (auth.uid() = user_id);

create policy "Service role can manage macro sent notifications"
  on public.macro_sent_notifications for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
