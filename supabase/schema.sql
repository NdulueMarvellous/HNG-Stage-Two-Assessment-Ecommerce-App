-- ============================================================================
--  TechMart - Supabase schema
--  Run the whole file once in: Supabase Dashboard -> SQL Editor -> New query
--  Safe to re-run.
--
--  Tables : profiles, products, orders, order_items
--  Security: Row Level Security - a signed-in user can only read their own
--            profile and their own orders.
--  Orders  : created through public.place_order(), which prices the cart and
--            reduces stock inside Postgres (the browser never sets prices).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. profiles - one row per authenticated user (created automatically)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  phone      text,
  address    text,
  city       text,
  state      text,
  country    text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Creates the profile right after a user signs up (Google or email/password).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. products - the catalogue. `price` and `stock` are the source of truth.
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  price       numeric(10, 2) not null check (price >= 0),
  image_url   text,
  category    text not null,
  stock       integer not null default 0 check (stock >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);

-- ---------------------------------------------------------------------------
-- 3. orders - customer details + totals (written only by place_order())
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  order_number text not null unique,
  full_name    text not null,
  email        text not null,
  phone        text not null,
  address      text not null,
  city         text not null,
  state        text not null,
  country      text not null,
  subtotal     numeric(10, 2) not null default 0,
  delivery_fee numeric(10, 2) not null default 0,
  total        numeric(10, 2) not null default 0,
  status       text not null default 'pending',
  created_at   timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. order_items - the lines of each order
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  product_name text not null,
  unit_price   numeric(10, 2) not null,
  quantity     integer not null check (quantity > 0),
  line_total   numeric(10, 2) not null
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
--    Once RLS is enabled, anything without a policy is denied, so the client
--    can read products but can never write them, and can only ever see its
--    own profile and orders.
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- profiles: a user may read and update only their own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- products: readable by everyone (so anonymous visitors can browse the shop).
-- There is deliberately no insert/update/delete policy - only the SQL editor
-- or a service-role key can change the catalogue.
drop policy if exists "products_select_public" on public.products;
create policy "products_select_public" on public.products
  for select using (is_active = true);

-- orders: users can read their own orders only. Inserts happen exclusively
-- through place_order() (SECURITY DEFINER), so no insert policy is defined.
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

-- order_items: visible when the parent order belongs to the user
drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. place_order() - creates an order inside a single transaction
--      * the caller must be signed in (auth.uid())
--      * the checkout fields are validated here
--      * price + stock are read from products (prices from the browser are ignored)
--      * the stock row is locked, checked and then reduced
--      * subtotal / delivery fee / total are calculated in Postgres
--    Returns the created order as JSON.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_customer jsonb,
  p_items    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user         uuid := auth.uid();
  v_customer     jsonb;
  v_line         record;
  v_product      record;
  v_item         jsonb;
  v_lines        jsonb := '[]'::jsonb;
  v_qty          integer;
  v_subtotal     numeric(10, 2) := 0;
  v_delivery     numeric(10, 2) := 0;
  v_total        numeric(10, 2) := 0;
  v_order_id     uuid;
  v_order_number text;
begin
  -- 6.1 the caller must be authenticated ------------------------------------
  if v_user is null then
    raise exception 'Please sign in before placing an order.';
  end if;

  -- 6.2 validate the checkout information ----------------------------------
  if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Your checkout details are missing.';
  end if;

  v_customer := jsonb_build_object(
    'full_name', nullif(trim(coalesce(p_customer ->> 'full_name', '')), ''),
    'email',     nullif(trim(coalesce(p_customer ->> 'email', '')), ''),
    'phone',     nullif(trim(coalesce(p_customer ->> 'phone', '')), ''),
    'address',   nullif(trim(coalesce(p_customer ->> 'address', '')), ''),
    'city',      nullif(trim(coalesce(p_customer ->> 'city', '')), ''),
    'state',     nullif(trim(coalesce(p_customer ->> 'state', '')), ''),
    'country',   nullif(trim(coalesce(p_customer ->> 'country', '')), '')
  );

  if v_customer ->> 'full_name' is null
     or char_length(v_customer ->> 'full_name') < 3 then
    raise exception 'Please enter your full name.';
  end if;

  if v_customer ->> 'email' is null
     or v_customer ->> 'email' !~* '^[^@[:space:]]+@[^@[:space:]]+[.][A-Za-z]{2,}$' then
    raise exception 'Please enter a valid email address.';
  end if;

  if v_customer ->> 'phone' is null
     or char_length(regexp_replace(v_customer ->> 'phone', '[^0-9]', '', 'g')) < 10 then
    raise exception 'Please enter a valid phone number.';
  end if;

  if v_customer ->> 'address' is null
     or char_length(v_customer ->> 'address') < 5 then
    raise exception 'Please enter your delivery address.';
  end if;

  if v_customer ->> 'city' is null then
    raise exception 'Please enter your city.';
  end if;

  if v_customer ->> 'state' is null then
    raise exception 'Please enter your state.';
  end if;

  if v_customer ->> 'country' is null then
    raise exception 'Please enter your country.';
  end if;

  -- 6.3 validate the cart ---------------------------------------------------
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_qty := nullif(v_item ->> 'quantity', '')::integer;
    exception when others then
      raise exception 'Cart quantities must be whole numbers.';
    end;

    if (v_item ->> 'product_id') is null
       or (v_item ->> 'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'One of the items in your cart is invalid.';
    end if;

    if v_qty is null or v_qty < 1 then
      raise exception 'Cart quantities must be at least 1.';
    end if;
  end loop;

  -- 6.4 price the cart from the database and reserve the stock --------------
  -- `for update` locks each product row so two people cannot buy the last unit.
  -- Duplicate cart lines are merged, and rows are locked in a stable order.
  for v_line in
    select (elem ->> 'product_id')::uuid                            as product_id,
           sum(coalesce(nullif(elem ->> 'quantity', '')::int, 0))::int as quantity
      from jsonb_array_elements(p_items) as elem
     group by 1
     order by 1
  loop
    select p.id, p.name, p.price, p.stock, p.is_active
      into v_product
      from public.products p
     where p.id = v_line.product_id
       for update;

    if not found then
      raise exception 'A product in your cart no longer exists.';
    end if;

    if not v_product.is_active then
      raise exception '"%s" is no longer available for purchase.', v_product.name;
    end if;

    if v_product.stock < v_line.quantity then
      raise exception '"%s" only has %s left in stock, but you asked for %s.',
        v_product.name, v_product.stock, v_line.quantity;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_line.quantity);

    v_lines := v_lines || jsonb_build_object(
      'product_id',   v_product.id,
      'product_name', v_product.name,
      'unit_price',   v_product.price,
      'quantity',     v_line.quantity
    );
  end loop;

  if v_subtotal <= 0 then
    raise exception 'Your cart has no chargeable items.';
  end if;

  -- 6.5 authoritative totals ------------------------------------------------
  -- Keep these two numbers in sync with src/lib/constants.js
  -- (2500 = flat delivery fee, 150000 = free-delivery threshold, in NGN).
  v_delivery := case when v_subtotal >= 150000 then 0 else 2500 end;
  v_total    := v_subtotal + v_delivery;

  v_order_number := 'TM-' || to_char(now(), 'YYMMDD') || '-' ||
                    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- 6.6 write the order and its items ---------------------------------------
  insert into public.orders (
    user_id, order_number, full_name, email, phone, address, city, state, country,
    subtotal, delivery_fee, total, status
  )
  values (
    v_user, v_order_number,
    v_customer ->> 'full_name', v_customer ->> 'email', v_customer ->> 'phone',
    v_customer ->> 'address', v_customer ->> 'city', v_customer ->> 'state',
    v_customer ->> 'country',
    v_subtotal, v_delivery, v_total, 'pending'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, quantity, line_total
  )
  select
    v_order_id,
    (l ->> 'product_id')::uuid,
    l ->> 'product_name',
    (l ->> 'unit_price')::numeric,
    (l ->> 'quantity')::int,
    round((l ->> 'unit_price')::numeric * (l ->> 'quantity')::int, 2)
  from jsonb_array_elements(v_lines) as l;

  -- 6.7 reduce the stock (the rows were locked and checked in 6.4) -----------
  update public.products p
     set stock = p.stock - agg.quantity
    from (
      select (l ->> 'product_id')::uuid as product_id,
             (l ->> 'quantity')::int    as quantity
        from jsonb_array_elements(v_lines) as l
    ) agg
   where p.id = agg.product_id;

  return jsonb_build_object(
    'id',           v_order_id,
    'order_number', v_order_number,
    'subtotal',     v_subtotal,
    'delivery_fee', v_delivery,
    'total',        v_total,
    'status',       'pending',
    'created_at',   now()
  );
end;
$$;

-- Only signed-in users may call the function (PUBLIC/anon execute is revoked).
revoke all on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;

