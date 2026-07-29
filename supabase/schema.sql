-- Duka POS Normalized Schema

-- 1. Shops (Tenants)
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  name text not null,
  created_at timestamptz not null default now()
);
alter table shops enable row level security;
create policy "Shops are viewable by owner" on shops for select using (auth.uid() = owner_id);
create policy "Shops can be created by owner" on shops for insert with check (auth.uid() = owner_id);
create policy "Shops can be updated by owner" on shops for update using (auth.uid() = owner_id);

-- 2. Profiles (Staff)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid references shops(id) not null,
  role text not null default 'cashier',
  name text not null,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "Profiles are viewable by shop users" on profiles for select using (
  shop_id in (select shop_id from profiles where id = auth.uid()) or
  shop_id in (select id from shops where owner_id = auth.uid())
);

-- 3. Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) not null,
  name text not null,
  sku text,
  price numeric not null default 0,
  stock int not null default 0,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table products enable row level security;
create policy "Products are viewable by shop users" on products for select using (
  shop_id in (select shop_id from profiles where id = auth.uid()) or
  shop_id in (select id from shops where owner_id = auth.uid())
);
create policy "Products can be modified by shop users" on products for all using (
  shop_id in (select shop_id from profiles where id = auth.uid()) or
  shop_id in (select id from shops where owner_id = auth.uid())
);

-- 4. Sales
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) not null,
  cashier_id uuid references profiles(id),
  total numeric not null default 0,
  status text not null default 'completed', -- completed, pending_mpesa, failed
  created_at timestamptz not null default now()
);
alter table sales enable row level security;
create policy "Sales are viewable by shop users" on sales for select using (
  shop_id in (select shop_id from profiles where id = auth.uid()) or
  shop_id in (select id from shops where owner_id = auth.uid())
);
create policy "Sales can be inserted by shop users" on sales for insert with check (
  shop_id in (select shop_id from profiles where id = auth.uid()) or
  shop_id in (select id from shops where owner_id = auth.uid())
);

-- 5. Sale Items
create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade not null,
  product_id uuid references products(id),
  qty numeric not null default 1,
  price numeric not null,
  created_at timestamptz not null default now()
);
alter table sale_items enable row level security;
create policy "Sale items are viewable by shop users" on sale_items for select using (
  sale_id in (select id from sales where shop_id in (select shop_id from profiles where id = auth.uid()) or shop_id in (select id from shops where owner_id = auth.uid()))
);
create policy "Sale items can be inserted by shop users" on sale_items for insert with check (
  sale_id in (select id from sales where shop_id in (select shop_id from profiles where id = auth.uid()) or shop_id in (select id from shops where owner_id = auth.uid()))
);

-- 6. Debts (Mkopo)
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) not null,
  customer_name text not null,
  customer_phone text,
  amount numeric not null default 0,
  status text not null default 'unpaid',
  created_at timestamptz not null default now()
);
alter table debts enable row level security;
create policy "Debts are viewable by shop users" on debts for select using (
  shop_id in (select shop_id from profiles where id = auth.uid()) or
  shop_id in (select id from shops where owner_id = auth.uid())
);
create policy "Debts can be modified by shop users" on debts for all using (
  shop_id in (select shop_id from profiles where id = auth.uid()) or
  shop_id in (select id from shops where owner_id = auth.uid())
);
