-- Phase A3: per-user ticker uniqueness
-- Run AFTER admin-schema.sql (which already added user_id NOT NULL to tickers)

-- Drop the old global symbol uniqueness — different users can now hold the same symbol
alter table public.tickers drop constraint if exists tickers_symbol_key;

-- Per-user unique: a user can't add the same symbol twice
create unique index if not exists tickers_user_symbol_idx on public.tickers(user_id, symbol);

-- Update RLS: authenticated users can only delete their own tickers
drop policy if exists "Authenticated users can delete tickers" on public.tickers;
create policy "Users can delete own tickers"
  on public.tickers for delete
  using (auth.uid() = user_id);

-- Update RLS: authenticated users can only insert with their own user_id
drop policy if exists "Authenticated users can insert tickers" on public.tickers;
create policy "Users can insert own tickers"
  on public.tickers for insert
  with check (auth.uid() = user_id);
