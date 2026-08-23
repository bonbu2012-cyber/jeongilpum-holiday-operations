-- Custom order intake and in-app settings parity for Supabase deployments.
alter table public.products add column if not exists version integer not null default 1 check (version > 0);
alter table public.sales_seasons add column if not exists version integer not null default 1 check (version > 0);
alter table public.sales_seasons add column if not exists updated_at timestamptz not null default now();

create table if not exists public.custom_order_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  customer_name text not null,
  customer_phone text not null,
  gift_type text not null,
  quantity integer not null check (quantity > 0),
  budget_range text not null,
  fulfillment_preference text not null,
  preferred_schedule text not null default '',
  note text not null default '',
  status text not null default 'submitted' check (status in ('submitted','contacted','quoted','confirmed','closed','cancelled')),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_order_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_order_requests(id),
  event_type text not null,
  after_data jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.configuration_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_orders_status_created on public.custom_order_requests(status,created_at);
create index if not exists idx_custom_orders_phone on public.custom_order_requests(customer_phone);
create index if not exists idx_custom_order_events_request on public.custom_order_events(request_id,created_at);
create index if not exists idx_configuration_events_entity on public.configuration_events(entity_type,entity_id,created_at);

alter table public.custom_order_requests enable row level security;
alter table public.custom_order_events enable row level security;
alter table public.configuration_events enable row level security;

create policy custom_orders_service_all on public.custom_order_requests for all to service_role using(true) with check(true);
create policy custom_order_events_service_all on public.custom_order_events for all to service_role using(true) with check(true);
create policy configuration_events_service_all on public.configuration_events for all to service_role using(true) with check(true);
create policy custom_orders_operator_read on public.custom_order_requests for select to authenticated using(public.current_user_role() in ('sales','admin','superadmin'));
create policy configuration_events_admin_read on public.configuration_events for select to authenticated using(public.current_user_role() in ('admin','superadmin'));

create or replace function public.prevent_custom_order_delete() returns trigger language plpgsql as $$
begin
  raise exception 'custom orders cannot be hard deleted';
end
$$;

drop trigger if exists custom_orders_no_hard_delete on public.custom_order_requests;
create trigger custom_orders_no_hard_delete before delete on public.custom_order_requests for each row execute function public.prevent_custom_order_delete();