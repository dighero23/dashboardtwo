-- ── user_permissions ──────────────────────────────────────────────────────────

create table if not exists public.user_permissions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        unique not null references auth.users(id) on delete cascade,
  is_admin        boolean     not null default false,
  can_edit_stocks boolean     not null default false,
  can_edit_f1     boolean     not null default false,
  can_edit_macro  boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Users can only read their own row; all writes go through service role
alter table public.user_permissions enable row level security;

create policy "Users can read own permissions"
  on public.user_permissions for select
  using (auth.uid() = user_id);

-- Seed admin row
insert into public.user_permissions (user_id, is_admin, can_edit_stocks, can_edit_f1, can_edit_macro)
values ('3ae2a968-1613-480f-a351-e6d78324aacb', true, true, true, true)
on conflict (user_id) do update set
  is_admin        = true,
  can_edit_stocks = true,
  can_edit_f1     = true,
  can_edit_macro  = true,
  updated_at      = now();

-- ── tickers.user_id migration ──────────────────────────────────────────────────

-- 1. Add column as nullable so existing rows don't fail
alter table public.tickers
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Assign all existing tickers to the admin
update public.tickers
set user_id = '3ae2a968-1613-480f-a351-e6d78324aacb'
where user_id is null;

-- 3. Enforce NOT NULL now that every row has a value
alter table public.tickers
  alter column user_id set not null;

-- 4. Index for per-user lookups
create index if not exists tickers_user_id_idx on public.tickers(user_id);
