-- Duka POS — cloud sync schema. Run this ONCE in your Supabase project:
-- Supabase dashboard → SQL Editor → paste → Run.
--
-- Each shop signs in with email+password (Supabase Auth). Its POS state lives
-- in one row keyed by the auth user id. Row Level Security guarantees a shop
-- can only ever read/write its own row. Realtime pushes changes to all of the
-- shop's devices instantly.

create table if not exists shop_state (
  id uuid primary key references auth.users (id) on delete cascade,
  business text,
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table shop_state enable row level security;

drop policy if exists "own row select" on shop_state;
create policy "own row select" on shop_state for select using (auth.uid() = id);

drop policy if exists "own row insert" on shop_state;
create policy "own row insert" on shop_state for insert with check (auth.uid() = id);

drop policy if exists "own row update" on shop_state;
create policy "own row update" on shop_state for update using (auth.uid() = id);

-- Realtime: broadcast row changes to the shop's other devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'shop_state'
  ) then
    alter publication supabase_realtime add table shop_state;
  end if;
end $$;
