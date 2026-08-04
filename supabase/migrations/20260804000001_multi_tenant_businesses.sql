-- Phase 4: Multi-Tenant SaaS -- extend shops table with business metadata
-- Adds business_type and onboarding_complete to the existing shops table.

alter table shops
  add column if not exists business_type text not null default 'shop',
  add column if not exists onboarding_complete boolean not null default false;

-- Mark existing rows as already onboarded (they were set up before this migration).
update shops set onboarding_complete = true where onboarding_complete = false;

-- Semantic alias: businesses view = shops table (cleaner app naming).
create or replace view businesses as
  select
    id,
    owner_id,
    name,
    business_type,
    onboarding_complete,
    created_at
  from shops;

grant select on businesses to authenticated;

-- Fast lookup by owner (used in cloud sync get-my-shop queries)
create index if not exists idx_shops_owner_id on shops(owner_id);

comment on column products.shop_id is 'Tenant identifier -- equivalent to business_id in app terminology';
