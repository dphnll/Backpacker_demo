create extension if not exists pgcrypto;

create table if not exists public.trip_shares (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'trip_share.v1',
  token_hash text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  trip_id text not null,
  include_budget boolean not null default true,
  state jsonb not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_shares_owner_trip_unique unique (owner_user_id, trip_id),
  constraint trip_shares_state_object check (jsonb_typeof(state) = 'object')
);

create index if not exists trip_shares_owner_user_id_idx on public.trip_shares(owner_user_id);
create index if not exists trip_shares_token_hash_idx on public.trip_shares(token_hash);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trip_shares_updated_at on public.trip_shares;
create trigger set_trip_shares_updated_at
before update on public.trip_shares
for each row
execute function public.set_updated_at();

alter table public.trip_shares enable row level security;

drop policy if exists "trip_shares_owner_select" on public.trip_shares;
create policy "trip_shares_owner_select"
on public.trip_shares
for select
using (owner_user_id = auth.uid());

drop policy if exists "trip_shares_owner_insert" on public.trip_shares;
create policy "trip_shares_owner_insert"
on public.trip_shares
for insert
with check (owner_user_id = auth.uid());

drop policy if exists "trip_shares_owner_update" on public.trip_shares;
create policy "trip_shares_owner_update"
on public.trip_shares
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());
