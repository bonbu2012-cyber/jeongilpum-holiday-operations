-- 정일품 v2.1 Phase 0/1 Supabase schema
create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('sales','admin','superadmin','workshop');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.order_status as enum ('submitted','confirmed','in_progress','ready','fulfilled','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.fulfillment_type as enum ('pickup','shipping');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.package_status as enum ('planned','queued','in_progress','completed','available','handed_over','shipped','voided');
exception when duplicate_object then null; end $$;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id),
  name text not null,
  role public.user_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null,
  sales_start_date date not null,
  sales_end_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  code text not null unique,
  name text not null,
  subtitle text not null default '',
  description text not null default '',
  price integer not null check (price >= 0),
  customer_display_weight text,
  image_url text,
  sale_status text not null default 'on_sale',
  badge text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_availability (
  product_id uuid not null references public.products(id),
  date date not null,
  max_confirmed_qty integer check (max_confirmed_qty is null or max_confirmed_qty >= 0),
  override_status text,
  note text,
  primary key(product_id,date)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  season_id uuid not null references public.sales_seasons(id),
  buyer_name_snapshot text not null,
  buyer_phone_snapshot text not null,
  order_status public.order_status not null default 'submitted',
  fulfillment_type public.fulfillment_type not null,
  schedule_label text not null,
  recipient_name text,
  recipient_phone text,
  road_address text,
  detail_address text,
  customer_note text not null default '',
  total_amount integer not null check (total_amount >= 0),
  idempotency_key uuid not null unique,
  version integer not null default 1 check (version > 0),
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  list_price_snapshot integer not null check (list_price_snapshot >= 0),
  sale_unit_price integer not null check (sale_unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  package_code text not null unique,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  package_status public.package_status not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  event_type text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_products_active_order on public.products(active,display_order);
create index if not exists idx_orders_phone on public.orders(buyer_phone_snapshot);
create index if not exists idx_orders_status on public.orders(order_status);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_packages_order on public.packages(order_id);
create index if not exists idx_order_events_order on public.order_events(order_id,created_at);

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path=public
as $$ select role from public.user_profiles where auth_user_id=auth.uid() and active=true limit 1 $$;

create or replace function public.create_order_transaction(payload jsonb)
returns public.orders
language plpgsql security definer set search_path=public
as $$
declare
  existing_order public.orders;
  new_order public.orders;
  item jsonb;
  product_row public.products;
  calculated_total integer := 0;
  order_number text;
begin
  select * into existing_order from public.orders where idempotency_key=(payload->>'idempotency_key')::uuid;
  if found then return existing_order; end if;
  if coalesce(payload->>'buyer_name','')='' or coalesce(payload->>'buyer_phone','')='' then
    raise exception 'buyer information is required';
  end if;
  if jsonb_array_length(coalesce(payload->'items','[]'::jsonb))=0 then raise exception 'items are required'; end if;
  order_number := 'JI-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
  insert into public.orders(order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,fulfillment_type,schedule_label,recipient_name,recipient_phone,road_address,detail_address,customer_note,total_amount,idempotency_key)
  values(order_number,(payload->>'season_id')::uuid,payload->>'buyer_name',regexp_replace(payload->>'buyer_phone','\D','','g'),(payload->>'fulfillment_type')::public.fulfillment_type,payload->>'schedule_label',nullif(payload->>'recipient_name',''),nullif(regexp_replace(coalesce(payload->>'recipient_phone',''),'\D','','g'),''),nullif(payload->>'road_address',''),nullif(payload->>'detail_address',''),coalesce(payload->>'note',''),0,(payload->>'idempotency_key')::uuid)
  returning * into new_order;
  for item in select * from jsonb_array_elements(payload->'items') loop
    select * into product_row from public.products where id=(item->>'product_id')::uuid and active=true for share;
    if not found then raise exception 'product unavailable'; end if;
    if (item->>'quantity')::integer <= 0 then raise exception 'quantity must be positive'; end if;
    insert into public.order_items(order_id,product_id,product_name_snapshot,list_price_snapshot,sale_unit_price,quantity,line_total)
    values(new_order.id,product_row.id,product_row.name,product_row.price,product_row.price,(item->>'quantity')::integer,product_row.price*(item->>'quantity')::integer);
    calculated_total := calculated_total + product_row.price*(item->>'quantity')::integer;
  end loop;
  update public.orders set total_amount=calculated_total where id=new_order.id returning * into new_order;
  insert into public.order_events(order_id,event_type,after_data) values(new_order.id,'order_submitted',jsonb_build_object('total_amount',calculated_total));
  return new_order;
end $$;

revoke all on function public.create_order_transaction(jsonb) from public, anon, authenticated;
grant execute on function public.create_order_transaction(jsonb) to service_role;

alter table public.user_profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_availability enable row level security;
alter table public.sales_seasons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.packages enable row level security;
alter table public.order_events enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon,authenticated using(active=true);
drop policy if exists seasons_public_read on public.sales_seasons;
create policy seasons_public_read on public.sales_seasons for select to anon,authenticated using(active=true);

drop policy if exists operator_orders_read on public.orders;
create policy operator_orders_read on public.orders for select to authenticated using(public.current_user_role() in ('sales','admin','superadmin'));
drop policy if exists workshop_orders_read on public.orders;
create policy workshop_orders_read on public.orders for select to authenticated using(public.current_user_role()='workshop');
drop policy if exists operator_items_read on public.order_items;
create policy operator_items_read on public.order_items for select to authenticated using(public.current_user_role() in ('sales','admin','superadmin','workshop'));
drop policy if exists operator_packages_all on public.packages;
create policy operator_packages_all on public.packages for all to authenticated using(public.current_user_role() in ('sales','admin','superadmin','workshop')) with check(public.current_user_role() in ('sales','admin','superadmin','workshop'));
drop policy if exists admin_products_write on public.products;
create policy admin_products_write on public.products for all to authenticated using(public.current_user_role() in ('admin','superadmin')) with check(public.current_user_role() in ('admin','superadmin'));
drop policy if exists operator_events_read on public.order_events;
create policy operator_events_read on public.order_events for select to authenticated using(public.current_user_role() in ('sales','admin','superadmin','workshop'));

create or replace function public.prevent_order_delete() returns trigger language plpgsql as $$ begin raise exception 'orders cannot be hard deleted'; end $$;
drop trigger if exists orders_no_hard_delete on public.orders;
create trigger orders_no_hard_delete before delete on public.orders for each row execute function public.prevent_order_delete();
