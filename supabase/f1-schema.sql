-- ─────────────────────────────────────────────────────────────────────────────
-- Personal Dashboard 2.0 — Formula 1 Module Schema
-- Run this in your Supabase project → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── f1_cache ──────────────────────────────────────────────────────────────────
-- Server-side cache for Jolpica-F1 API responses.
create table if not exists public.f1_cache (
  cache_key   text        primary key,
  data        jsonb       not null,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- ── f1_notification_preferences ───────────────────────────────────────────────
create table if not exists public.f1_notification_preferences (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  week_ahead    boolean     not null default true,
  pre_quali     boolean     not null default true,
  quali_result  boolean     not null default true,
  pre_race      boolean     not null default true,
  race_result   boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id)
);

-- ── f1_sent_notifications ─────────────────────────────────────────────────────
-- Deduplication log — prevents sending the same notification twice.
create table if not exists public.f1_sent_notifications (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  race_season       integer     not null,
  race_round        integer     not null,
  notification_type text        not null check (notification_type in ('week_ahead', 'pre_quali', 'quali_result', 'pre_race', 'race_result')),
  sent_at           timestamptz not null default now()
);

create unique index if not exists f1_sent_notif_dedup_idx
  on public.f1_sent_notifications(user_id, race_season, race_round, notification_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.f1_cache                    enable row level security;
alter table public.f1_notification_preferences enable row level security;
alter table public.f1_sent_notifications       enable row level security;

-- f1_cache: public read, service role writes
create policy "Public can read f1_cache"
  on public.f1_cache for select using (true);

create policy "Service role can upsert f1_cache"
  on public.f1_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- f1_notification_preferences: users manage their own row
create policy "Users can read own f1 prefs"
  on public.f1_notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own f1 prefs"
  on public.f1_notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own f1 prefs"
  on public.f1_notification_preferences for update
  using (auth.uid() = user_id);

-- f1_sent_notifications: service role writes, users read their own
create policy "Users can read own f1 sent notifications"
  on public.f1_sent_notifications for select
  using (auth.uid() = user_id);

create policy "Service role can manage f1 sent notifications"
  on public.f1_sent_notifications for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
