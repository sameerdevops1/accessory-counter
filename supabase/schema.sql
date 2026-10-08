-- Accessory Counter: database for Supabase (Postgres).
-- Run this whole file once: Supabase dashboard > SQL Editor > New query > paste > Run.

create extension if not exists pgcrypto;

-- Normalises a phone number so 07700 900123 and +44 7700 900123 match.
create or replace function phone_key(p text) returns text
language sql immutable as $$
  select regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^(00)?44', '0')
$$;

-- ---------- who is an admin ----------
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security;  -- no policies: only is_admin() reads it

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- ---------- tables ----------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  shop_name text not null default 'Accessory Counter',
  contact text not null default '',
  pickup_note text not null default ''
);
insert into settings default values on conflict do nothing;

-- Public product facts. Customers can read published rows only.
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null default '',
  category text not null default '',
  model text not null default '',
  description text not null default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  sku text unique,
  barcode text unique,
  photo_url text not null default '',
  published boolean not null default true,
  in_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private business facts. Admin only: cost, quantity, supplier, bin.
create table if not exists product_private (
  product_id uuid primary key references products(id) on delete cascade,
  cost numeric(10,2) not null default 0,
  qty int not null default 0 check (qty >= 0),
  low_at int not null default 5,
  supplier text not null default '',
  location text not null default ''
);

create table if not exists stock_moves (
  id bigint generated always as identity primary key,
  product_id uuid not null references products(id) on delete cascade,
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists stock_moves_product_idx on stock_moves (product_id, created_at desc);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  phone_key text not null unique,
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

do $$ begin
  create type order_status as enum ('new','confirmed','preparing','ready','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status order_status not null default 'new',
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null default '',
  customer_address text not null default '',
  note text not null default '',
  total numeric(10,2) not null default 0,
  stock_taken boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on orders (created_at desc);

create table if not exists order_lines (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  unit_price numeric(10,2) not null,
  qty int not null check (qty > 0)
);
create index if not exists order_lines_order_idx on order_lines (order_id);

-- Keeps the public "in stock" flag in step with the private quantity.
create or replace function sync_in_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update products set in_stock = (new.qty > 0), updated_at = now() where id = new.product_id;
  return new;
end $$;

drop trigger if exists trg_sync_in_stock on product_private;
create trigger trg_sync_in_stock
after insert or update of qty on product_private
for each row execute function sync_in_stock();

-- ---------- row level security ----------
alter table settings enable row level security;
alter table products enable row level security;
alter table product_private enable row level security;
alter table stock_moves enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;

drop policy if exists "settings public read" on settings;
create policy "settings public read" on settings for select using (true);
drop policy if exists "settings admin write" on settings;
create policy "settings admin write" on settings for all using (is_admin()) with check (is_admin());

drop policy if exists "products public read" on products;
create policy "products public read" on products for select using (published);
drop policy if exists "products admin all" on products;
create policy "products admin all" on products for all using (is_admin()) with check (is_admin());

drop policy if exists "private admin only" on product_private;
create policy "private admin only" on product_private for all using (is_admin()) with check (is_admin());
drop policy if exists "stock moves admin only" on stock_moves;
create policy "stock moves admin only" on stock_moves for all using (is_admin()) with check (is_admin());
drop policy if exists "customers admin only" on customers;
create policy "customers admin only" on customers for all using (is_admin()) with check (is_admin());
drop policy if exists "orders admin only" on orders;
create policy "orders admin only" on orders for all using (is_admin()) with check (is_admin());
drop policy if exists "order lines admin only" on order_lines;
create policy "order lines admin only" on order_lines for all using (is_admin()) with check (is_admin());

-- ---------- public actions (the only way a visitor can write) ----------
-- Prices and availability are read from the products table here, never from the browser.
create or replace function place_order(
  p_name text, p_phone text, p_email text, p_address text, p_note text, p_lines jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_key text := phone_key(p_phone);
  v_id uuid;
  v_code text;
  v_cust uuid;
  v_total numeric(10,2) := 0;
  l jsonb;
  p products%rowtype;
  v_qty int;
begin
  if coalesce(trim(p_name), '') = '' or length(v_key) < 7 then
    raise exception 'Name and a mobile number are required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) not between 1 and 50 then
    raise exception 'Your basket is empty';
  end if;

  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
      into v_code from generate_series(1, 4);
    exit when not exists (select 1 from orders where code = v_code);
  end loop;

  insert into customers (name, phone, phone_key, email, address)
  values (left(trim(p_name), 80), left(trim(p_phone), 30), v_key,
          left(coalesce(trim(p_email), ''), 120), left(coalesce(trim(p_address), ''), 240))
  on conflict (phone_key) do update
    set email = coalesce(nullif(customers.email, ''), excluded.email),
        address = coalesce(nullif(customers.address, ''), excluded.address)
  returning id into v_cust;

  insert into orders (code, customer_id, customer_name, customer_phone, customer_email, customer_address, note)
  values (v_code, v_cust, left(trim(p_name), 80), left(trim(p_phone), 30),
          left(coalesce(trim(p_email), ''), 120), left(coalesce(trim(p_address), ''), 240),
          left(coalesce(trim(p_note), ''), 500))
  returning id into v_id;

  for l in select jsonb_array_elements(p_lines) loop
    v_qty := (l ->> 'qty')::int;
    select * into p from products
      where id = (l ->> 'product_id')::uuid and published and in_stock;
    if not found or v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'An item in your basket is no longer available';
    end if;
    insert into order_lines (order_id, product_id, name, unit_price, qty)
    values (v_id, p.id, p.name, p.price, v_qty);
    v_total := v_total + p.price * v_qty;
  end loop;

  update orders set total = v_total where id = v_id;
  return v_code;
end $$;

-- A customer can look up their own order with its code and their phone number.
create or replace function track_order(p_code text, p_phone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', o.code,
    'status', o.status,
    'total', o.total,
    'created_at', o.created_at,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                'name', ol.name, 'qty', ol.qty, 'unit_price', ol.unit_price) order by ol.id), '[]'::jsonb)
              from order_lines ol where ol.order_id = o.id)
  )
  from orders o
  where o.code = upper(trim(p_code)) and phone_key(o.customer_phone) = phone_key(p_phone)
$$;

-- ---------- admin actions ----------
create or replace function adjust_stock(p_product uuid, p_delta int, p_reason text, p_cost numeric default null)
returns int
language plpgsql security definer set search_path = public as $$
declare q int;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  update product_private
     set qty = qty + p_delta, cost = coalesce(p_cost, cost)
   where product_id = p_product and qty + p_delta >= 0
  returning qty into q;
  if q is null then raise exception 'Stock cannot go below zero'; end if;
  insert into stock_moves (product_id, delta, reason) values (p_product, p_delta, p_reason);
  return q;
end $$;

create or replace function set_order_status(p_order uuid, p_status order_status) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders%rowtype;
  l order_lines%rowtype;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;

  if p_status = 'confirmed' and not o.stock_taken then
    for l in select * from order_lines where order_id = p_order loop
      if l.product_id is null then
        raise exception '% is no longer in your catalogue', l.name;
      end if;
      update product_private set qty = qty - l.qty where product_id = l.product_id and qty >= l.qty;
      if not found then
        raise exception 'Not enough stock for %', l.name;
      end if;
      insert into stock_moves (product_id, delta, reason) values (l.product_id, -l.qty, 'Order ' || o.code);
    end loop;
    update orders set stock_taken = true where id = p_order;
  elsif p_status = 'cancelled' and o.stock_taken then
    for l in select * from order_lines where order_id = p_order loop
      if l.product_id is not null then
        update product_private set qty = qty + l.qty where product_id = l.product_id;
        insert into stock_moves (product_id, delta, reason) values (l.product_id, l.qty, 'Cancelled ' || o.code);
      end if;
    end loop;
    update orders set stock_taken = false where id = p_order;
  end if;

  update orders set status = p_status, updated_at = now() where id = p_order;
end $$;

-- Counter sale: records a completed sale and takes stock off straight away.
-- Used by the Sell screen (scan items, tap Complete sale). Customer details are optional.
create or replace function record_sale(
  p_lines jsonb, p_name text default '', p_phone text default '', p_note text default ''
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_key text := phone_key(p_phone);
  v_id uuid;
  v_code text;
  v_cust uuid;
  v_total numeric(10,2) := 0;
  l jsonb;
  p products%rowtype;
  v_qty int;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception 'Add at least one item to the sale';
  end if;

  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
      into v_code from generate_series(1, 4);
    exit when not exists (select 1 from orders where code = v_code);
  end loop;

  if coalesce(trim(p_name), '') <> '' and length(v_key) >= 7 then
    insert into customers (name, phone, phone_key)
    values (left(trim(p_name), 80), left(trim(p_phone), 30), v_key)
    on conflict (phone_key) do update set name = customers.name
    returning id into v_cust;
  end if;

  insert into orders (code, status, customer_id, customer_name, customer_phone, note, stock_taken)
  values (v_code, 'completed', v_cust,
          coalesce(nullif(left(trim(p_name), 80), ''), 'Walk-in'),
          left(coalesce(trim(p_phone), ''), 30),
          left('Counter sale. ' || coalesce(trim(p_note), ''), 500), true)
  returning id into v_id;

  for l in select jsonb_array_elements(p_lines) loop
    v_qty := (l ->> 'qty')::int;
    select * into p from products where id = (l ->> 'product_id')::uuid;
    if not found or v_qty is null or v_qty < 1 or v_qty > 999 then
      raise exception 'An item in this sale is not in your catalogue';
    end if;
    update product_private set qty = qty - v_qty where product_id = p.id and qty >= v_qty;
    if not found then
      raise exception 'Not enough stock for %', p.name;
    end if;
    insert into order_lines (order_id, product_id, name, unit_price, qty)
    values (v_id, p.id, p.name, p.price, v_qty);
    insert into stock_moves (product_id, delta, reason) values (p.id, -v_qty, 'Sale ' || v_code);
    v_total := v_total + p.price * v_qty;
  end loop;

  update orders set total = v_total where id = v_id;
  return v_code;
end $$;

revoke all on function record_sale(jsonb, text, text, text) from public;
grant execute on function record_sale(jsonb, text, text, text) to authenticated;

revoke all on function adjust_stock(uuid, int, text, numeric) from public;
revoke all on function set_order_status(uuid, order_status) from public;
grant execute on function adjust_stock(uuid, int, text, numeric) to authenticated;
grant execute on function set_order_status(uuid, order_status) to authenticated;
grant execute on function place_order(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function track_order(text, text) to anon, authenticated;

-- ---------- product photos ----------
insert into storage.buckets (id, name, public) values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "photos admin insert" on storage.objects;
create policy "photos admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and public.is_admin());
drop policy if exists "photos admin update" on storage.objects;
create policy "photos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and public.is_admin());
drop policy if exists "photos admin delete" on storage.objects;
create policy "photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and public.is_admin());

-- ---------- counter sales (scan and sell in the shop) ----------
-- Saved as an order that is already completed, with stock taken off straight away.
create or replace function record_sale(p_name text, p_phone text, p_note text, p_lines jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_key text := phone_key(p_phone);
  v_id uuid;
  v_code text;
  v_cust uuid;
  v_total numeric(10,2) := 0;
  v_name text := coalesce(nullif(trim(p_name), ''), 'Walk-in customer');
  l jsonb;
  p products%rowtype;
  v_qty int;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception 'The sale is empty';
  end if;

  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
      into v_code from generate_series(1, 4);
    exit when not exists (select 1 from orders where code = v_code);
  end loop;

  if length(v_key) >= 7 then
    insert into customers (name, phone, phone_key)
    values (left(v_name, 80), left(trim(p_phone), 30), v_key)
    on conflict (phone_key) do update set name = customers.name
    returning id into v_cust;
  end if;

  insert into orders (code, status, customer_id, customer_name, customer_phone, note, stock_taken)
  values (v_code, 'completed', v_cust, left(v_name, 80), left(coalesce(trim(p_phone), ''), 30),
          left(coalesce(trim(p_note), 'Counter sale'), 500), true)
  returning id into v_id;

  for l in select jsonb_array_elements(p_lines) loop
    v_qty := (l ->> 'qty')::int;
    select * into p from products where id = (l ->> 'product_id')::uuid;
    if not found or v_qty is null or v_qty < 1 then
      raise exception 'An item in this sale is not in your catalogue';
    end if;
    update product_private set qty = qty - v_qty where product_id = p.id and qty >= v_qty;
    if not found then
      raise exception 'Not enough stock for %', p.name;
    end if;
    insert into order_lines (order_id, product_id, name, unit_price, qty)
    values (v_id, p.id, p.name, p.price, v_qty);
    insert into stock_moves (product_id, delta, reason) values (p.id, -v_qty, 'Sale ' || v_code);
    v_total := v_total + p.price * v_qty;
  end loop;

  update orders set total = v_total where id = v_id;
  return v_code;
end $$;

revoke all on function record_sale(text, text, text, jsonb) from public;
grant execute on function record_sale(text, text, text, jsonb) to authenticated;
