-- Update foreign keys to use ON DELETE CASCADE to allow deleting a tenant

-- 1. Shops -> auth.users
alter table shops drop constraint if exists shops_owner_id_fkey;
alter table shops add constraint shops_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete cascade;

-- 2. Profiles -> shops
alter table profiles drop constraint if exists profiles_shop_id_fkey;
alter table profiles add constraint profiles_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade;

-- 3. Products -> shops
alter table products drop constraint if exists products_shop_id_fkey;
alter table products add constraint products_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade;

-- 4. Sales -> shops
alter table sales drop constraint if exists sales_shop_id_fkey;
alter table sales add constraint sales_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade;

-- 5. Debts -> shops
alter table debts drop constraint if exists debts_shop_id_fkey;
alter table debts add constraint debts_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade;

-- 6. Sales -> profiles (cashier)
alter table sales drop constraint if exists sales_cashier_id_fkey;
alter table sales add constraint sales_cashier_id_fkey foreign key (cashier_id) references profiles(id) on delete set null;
