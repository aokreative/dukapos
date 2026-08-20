-- Phase 2 Subscription Migration

-- 1. Create the admin_set_subscription RPC
create or replace function admin_set_subscription(target_shop_id uuid, new_expiry timestamptz)
returns void
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'aokreative@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  update shops
  set subscription_expires_at = new_expiry
  where id = target_shop_id;
end;
$$ language plpgsql;

-- 2. Create the protective trigger on shops
create or replace function protect_shop_subscription() returns trigger
security invoker
set search_path = public
as $$
begin
  -- If not superadmin or service role, deny changes to subscription fields
  if coalesce(auth.jwt() ->> 'email','') <> 'aokreative@gmail.com'
     and current_setting('role', true) is distinct from 'service_role' then
    
    if tg_op = 'UPDATE' then
      if new.subscription_expires_at is distinct from old.subscription_expires_at or
         new.trial_started_at is distinct from old.trial_started_at then
         raise exception 'Unauthorized: subscription fields are read-only for clients';
      end if;
    end if;
    
    if tg_op = 'INSERT' then
      -- Clients cannot set these values arbitrarily; force default
      new.trial_started_at = now();
      new.subscription_expires_at = null;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists ensure_shop_subscription_protected on shops;
create trigger ensure_shop_subscription_protected
before insert or update on shops
for each row
execute function protect_shop_subscription();
