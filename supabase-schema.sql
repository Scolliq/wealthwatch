-- ═══════════════════════════════════════════════════════════
-- WealthWatch — Supabase Database Schema v2
-- Run this in your Supabase SQL Editor (supabase.com → SQL)
-- ═══════════════════════════════════════════════════════════

-- Drop old table if exists (from v1)
drop table if exists holdings cascade;

-- ─── User Profiles ──────────────────────────────────────
-- Extends Supabase auth.users with display preferences

create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  default_currency text default 'USD',
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Holdings ───────────────────────────────────────────
-- Portfolio positions with asset type classification

create table if not exists holdings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  asset_type text not null default 'equity'
    check (asset_type in ('equity', 'bond', 'commodity', 'crypto', 'etf')),
  qty numeric not null check (qty > 0),
  avg_cost numeric not null check (avg_cost >= 0),
  purchase_date date,
  notes text,
  added_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, symbol)
);

alter table holdings enable row level security;

create policy "Users can view own holdings"
  on holdings for select using (auth.uid() = user_id);
create policy "Users can insert own holdings"
  on holdings for insert with check (auth.uid() = user_id);
create policy "Users can update own holdings"
  on holdings for update using (auth.uid() = user_id);
create policy "Users can delete own holdings"
  on holdings for delete using (auth.uid() = user_id);

create index if not exists holdings_user_id_idx on holdings(user_id);
create index if not exists holdings_asset_type_idx on holdings(user_id, asset_type);

-- ─── Transactions ───────────────────────────────────────
-- Full transaction history for audit trail and analytics

create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  asset_type text not null default 'equity'
    check (asset_type in ('equity', 'bond', 'commodity', 'crypto', 'etf')),
  action text not null check (action in ('buy', 'sell')),
  qty numeric not null check (qty > 0),
  price numeric not null check (price >= 0),
  fees numeric default 0 check (fees >= 0),
  notes text,
  executed_at timestamptz default now()
);

alter table transactions enable row level security;

create policy "Users can view own transactions"
  on transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions"
  on transactions for insert with check (auth.uid() = user_id);

create index if not exists transactions_user_id_idx on transactions(user_id);
create index if not exists transactions_symbol_idx on transactions(user_id, symbol);
create index if not exists transactions_date_idx on transactions(user_id, executed_at desc);

-- ─── Watchlists ─────────────────────────────────────────
-- User-customizable watchlist

create table if not exists watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  added_at timestamptz default now(),
  unique(user_id, symbol)
);

alter table watchlist enable row level security;

create policy "Users can view own watchlist"
  on watchlist for select using (auth.uid() = user_id);
create policy "Users can insert own watchlist"
  on watchlist for insert with check (auth.uid() = user_id);
create policy "Users can delete own watchlist"
  on watchlist for delete using (auth.uid() = user_id);

-- ─── Helper Views ───────────────────────────────────────

-- Portfolio summary view (holdings grouped by asset type)
create or replace view portfolio_summary as
select
  user_id,
  asset_type,
  count(*) as position_count,
  sum(qty * avg_cost) as total_cost_basis
from holdings
group by user_id, asset_type;

-- Transaction summary (total bought/sold per symbol)
create or replace view transaction_summary as
select
  user_id,
  symbol,
  asset_type,
  sum(case when action = 'buy' then qty else 0 end) as total_bought,
  sum(case when action = 'sell' then qty else 0 end) as total_sold,
  sum(case when action = 'buy' then qty * price else 0 end) as total_invested,
  sum(case when action = 'sell' then qty * price else 0 end) as total_received,
  count(*) as trade_count,
  min(executed_at) as first_trade,
  max(executed_at) as last_trade
from transactions
group by user_id, symbol, asset_type;
