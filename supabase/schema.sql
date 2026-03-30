-- ─────────────────────────────────────────────────────────────────────────────
-- Personal Dashboard 2.0 — Stock Tracker Schema
-- Run this in your Supabase project → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── tickers ──────────────────────────────────────────────────────────────────
create table if not exists public.tickers (
  id          uuid        primary key default gen_random_uuid(),
  symbol      text        not null unique,
  name        text,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

-- ── price_cache ───────────────────────────────────────────────────────────────
create table if not exists public.price_cache (
  ticker_id       uuid        primary key references public.tickers(id) on delete cascade,
  current_price   numeric     not null default 0,
  change_pct      numeric,
  ath_3y          numeric,
  ath_pct         numeric,
  earnings_date   date,
  updated_at      timestamptz not null default now()
);

-- ── alerts ────────────────────────────────────────────────────────────────────
create table if not exists public.alerts (
  id                uuid        primary key default gen_random_uuid(),
  ticker_id         uuid        not null references public.tickers(id) on delete cascade,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  target_price      numeric     not null,
  comment           text,
  is_display_target boolean     not null default false,
  status            text        not null default 'active' check (status in ('active', 'triggered')),
  triggered_at      timestamptz,
  cooldown_until    timestamptz,
  created_at        timestamptz not null default now()
);

-- ── push_subscriptions ────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  endpoint     text        not null,
  keys_p256dh  text        not null,
  keys_auth    text        not null,
  device_label text,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists alerts_ticker_id_idx on public.alerts(ticker_id);
create index if not exists alerts_user_id_idx   on public.alerts(user_id);
create index if not exists alerts_status_idx    on public.alerts(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.tickers           enable row level security;
alter table public.price_cache       enable row level security;
alter table public.alerts            enable row level security;
alter table public.push_subscriptions enable row level security;

-- tickers: public read, authenticated write
create policy "Public can read tickers"
  on public.tickers for select using (true);

create policy "Authenticated users can insert tickers"
  on public.tickers for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete tickers"
  on public.tickers for delete
  using (auth.role() = 'authenticated');

-- price_cache: public read, service role writes (via cron/refresh)
create policy "Public can read price_cache"
  on public.price_cache for select using (true);

create policy "Service role can upsert price_cache"
  on public.price_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- alerts: users manage their own rows
create policy "Users can read own alerts"
  on public.alerts for select
  using (auth.uid() = user_id);

create policy "Users can insert own alerts"
  on public.alerts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own alerts"
  on public.alerts for update
  using (auth.uid() = user_id);

create policy "Users can delete own alerts"
  on public.alerts for delete
  using (auth.uid() = user_id);

-- push_subscriptions: users manage their own rows
create policy "Users can read own subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: initial tickers
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.tickers (symbol, name, sort_order) values
  ('AAPL',  'Apple Inc.',             1),
  ('NVDA',  'NVIDIA Corporation',     2),
  ('MSFT',  'Microsoft Corporation',  3),
  ('AMZN',  'Amazon.com Inc.',        4),
  ('TSLA',  'Tesla Inc.',             5),
  ('META',  'Meta Platforms Inc.',    6),
  ('GOOGL', 'Alphabet Inc.',          7),
  ('BRK.B', 'Berkshire Hathaway',     8),
  ('JPM',   'JPMorgan Chase & Co.',   9),
  ('VOO',   'Vanguard S&P 500 ETF',  10)
on conflict (symbol) do nothing;
