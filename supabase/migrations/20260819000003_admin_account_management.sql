-- Migration: Admin account management RPCs
-- Adds a `suspended` flag to shops and three admin-only RPC functions:
--   admin_suspend_tenant   — soft-suspends a shop
--   admin_reactivate_tenant — lifts a suspension
--   admin_delete_tenant    — permanently removes a shop and all its data

-- 1. Add suspended column to shops (safe, idempotent)
alter table shops
  add column if not exists suspended boolean not null default false;

-- 2. Update get_all_tenants to return billing-relevant columns and real status
create or replace function get_all_tenants()
returns table (
  id           uuid,
  email        text,
  business     text,
  business_type text,
  phone        text,
  status       text,
  plan_id      text,
  cycle        text,
  amount_due   numeric,
  balance_due  numeric,
  current_period_end timestamptz,
  created_at   timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only the platform super-admin can call this
  if (auth.jwt() ->> 'email') != 'aokreative@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    s.id,
    u.email::text                                         as email,
    s.name                                                as business,
    s.business_type,
    null::text                                            as phone,
    case when s.suspended then 'suspended' else 'active' end as status,
    'standard'::text                                      as plan_id,
    'monthly'::text                                       as cycle,
    0::numeric                                            as amount_due,
    0::numeric                                            as balance_due,
    null::timestamptz                                     as current_period_end,
    s.created_at
  from shops s
  left join auth.users u on s.owner_id = u.id
  order by s.created_at desc;
end;
$$;

-- 3. Suspend a tenant (soft-suspend — data is preserved)
create or replace function admin_suspend_tenant(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'email') != 'aokreative@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  update shops set suspended = true where id = p_shop_id;

  if not found then
    raise exception 'Shop not found: %', p_shop_id;
  end if;
end;
$$;

-- 4. Reactivate a suspended tenant
create or replace function admin_reactivate_tenant(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'email') != 'aokreative@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  update shops set suspended = false where id = p_shop_id;

  if not found then
    raise exception 'Shop not found: %', p_shop_id;
  end if;
end;
$$;

-- 5. Permanently delete a tenant and all their data
--    Cascade order: sale_items → sales → debts → products → profiles → shops
--    auth.users is deleted last (this also invalidates their session tokens)
create or replace function admin_delete_tenant(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  if (auth.jwt() ->> 'email') != 'aokreative@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  -- Capture owner before we delete
  select owner_id into v_owner_id from shops where id = p_shop_id;
  if not found then
    raise exception 'Shop not found: %', p_shop_id;
  end if;

  -- Delete dependent data in safe order (FK cascade handles most of it,
  -- but being explicit makes this safe even without cascade on every table)
  delete from sale_items where sale_id in (select id from sales where shop_id = p_shop_id);
  delete from sales        where shop_id = p_shop_id;
  delete from debts        where shop_id = p_shop_id;
  delete from products     where shop_id = p_shop_id;
  delete from profiles     where shop_id = p_shop_id;
  delete from shops        where id      = p_shop_id;

  -- Remove the auth account so the owner cannot log back in
  delete from auth.users where id = v_owner_id;
end;
$$;

-- 6. Grant execute to authenticated role (the security definer email check
--    inside each function is the real guard — non-admins get an exception)
grant execute on function get_all_tenants()                     to authenticated;
grant execute on function admin_suspend_tenant(uuid)            to authenticated;
grant execute on function admin_reactivate_tenant(uuid)         to authenticated;
grant execute on function admin_delete_tenant(uuid)             to authenticated;
