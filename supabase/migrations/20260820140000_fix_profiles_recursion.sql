-- Create a STABLE security definer helper to break the recursion
-- NOTE: Owners DO NOT get a row in the `profiles` table. They rely exclusively on the 
-- `shops.owner_id = auth.uid()` path in all policies. This helper returns null for owners, 
-- but the `OR` clauses in the policies ensure they maintain full access.
create or replace function get_current_user_profile_shop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select shop_id from profiles where id = auth.uid() limit 1;
$$;

-- Drop existing policies that use the recursion
drop policy if exists "Profiles are viewable by shop users" on profiles;
drop policy if exists "Profiles can be inserted by shop users" on profiles;
drop policy if exists "Profiles can be updated by shop users" on profiles;

drop policy if exists "Products are viewable by shop users" on products;
drop policy if exists "Products can be modified by shop users" on products;

drop policy if exists "Sales are viewable by shop users" on sales;
drop policy if exists "Sales can be inserted by shop users" on sales;
drop policy if exists "Sales can be updated by shop users" on sales;

drop policy if exists "Sale items are viewable by shop users" on sale_items;
drop policy if exists "Sale items can be inserted by shop users" on sale_items;

drop policy if exists "Debts are viewable by shop users" on debts;
drop policy if exists "Debts can be modified by shop users" on debts;

-- Recreate policies using the new helper

-- Profiles: Owners can do everything for their shop. Staff can only read their shop's profiles.
-- Staff rows are created by the shop owner inserting a row specifying the user's id.
create policy "Profiles are viewable by shop users" on profiles for select using (
  shop_id = get_current_user_profile_shop_id() or
  shop_id in (select id from shops where owner_id = auth.uid())
);
create policy "Profiles can be inserted by shop owner" on profiles for insert with check (
  shop_id in (select id from shops where owner_id = auth.uid())
  and role in ('cashier', 'manager')
);
create policy "Profiles can be updated by shop owner" on profiles for update using (
  shop_id in (select id from shops where owner_id = auth.uid())
) with check (
  shop_id in (select id from shops where owner_id = auth.uid())
  and role in ('cashier', 'manager')
);
create policy "Profiles can be deleted by shop owner" on profiles for delete using (
  shop_id in (select id from shops where owner_id = auth.uid())
);

-- Products
create policy "Products are viewable by shop users" on products for select using (
  shop_id = get_current_user_profile_shop_id() or
  shop_id in (select id from shops where owner_id = auth.uid())
);
create policy "Products can be modified by shop users" on products for all using (
  shop_id = get_current_user_profile_shop_id() or
  shop_id in (select id from shops where owner_id = auth.uid())
) with check (
  shop_id = get_current_user_profile_shop_id() or
  shop_id in (select id from shops where owner_id = auth.uid())
);

-- Sales
create policy "Sales are viewable by shop users" on sales for select using (
  shop_id = get_current_user_profile_shop_id() or
  shop_id in (select id from shops where owner_id = auth.uid())
);
create policy "Sales can be inserted by shop users" on sales for insert with check (
  shop_id = get_current_user_profile_shop_id() or
  shop_id in (select id from shops where owner_id = auth.uid())
);

-- Sale Items (Immutable - updates/deletes to sales are handled on the sales record)
create policy "Sale items are viewable by shop users" on sale_items for select using (
  sale_id in (select id from sales where 
    shop_id = get_current_user_profile_shop_id() or 
    shop_id in (select id from shops where owner_id = auth.uid())
  )
);
create policy "Sale items can be inserted by shop users" on sale_items for insert with check (
  sale_id in (select id from sales where 
    shop_id = get_current_user_profile_shop_id() or 
    shop_id in (select id from shops where owner_id = auth.uid())
  )
);

-- Debts
create policy "Debts are viewable by shop users" on debts for select using (
  shop_id = get_current_user_profile_shop_id() or
  shop_id in (select id from shops where owner_id = auth.uid())
);
create policy "Debts can be modified by shop users" on debts for all using (
  shop_id = get_current_user_profile_shop_id() or
  shop_id in (select id from shops where owner_id = auth.uid())
) with check (
  shop_id = get_current_user_profile_shop_id() or
  shop_id in (select id from shops where owner_id = auth.uid())
);
