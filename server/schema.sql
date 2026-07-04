-- Duka POS — subscription database schema (Postgres / Supabase).
-- The backend creates this automatically on startup, but you can also run it
-- once by hand in the Supabase SQL editor.

create table if not exists tenants (
  id uuid primary key,
  business text not null,
  phone text unique,
  plan_id text not null default 'standard',
  cycle text not null default 'monthly',
  auto_renew boolean not null default true,
  created_at bigint not null,
  trial_ends_at bigint not null,
  current_period_end bigint not null,
  last_payment_at bigint,
  last_charge_attempt_at bigint,
  invoices jsonb not null default '[]'::jsonb
);

create index if not exists idx_tenants_phone on tenants(phone);
