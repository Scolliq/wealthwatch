-- ═══════════════════════════════════════════════════════════
-- WealthWatch — Supabase Database Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL)
-- ═══════════════════════════════════════════════════════════

-- Holdings table: stores user portfolio positions
create table if not exists holdings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  qty numeric not null check (qty > 0),
  avg_cost numeric not null check (avg_cost > 0),
  added_at timestamptz default now(),
  unique(user_id, symbol)
);

-- Enable Row Level Security
alter table holdings enable row level security;

-- Users can only see their own holdings
create policy "Users can view own holdings"
  on holdings for select
  using (auth.uid() = user_id);

-- Users can only insert their own holdings
create policy "Users can insert own holdings"
  on holdings for insert
  with check (auth.uid() = user_id);

-- Users can only update their own holdings
create policy "Users can update own holdings"
  on holdings for update
  using (auth.uid() = user_id);

-- Users can only delete their own holdings
create policy "Users can delete own holdings"
  on holdings for delete
  using (auth.uid() = user_id);

-- Index for faster queries
create index if not exists holdings_user_id_idx on holdings(user_id);
