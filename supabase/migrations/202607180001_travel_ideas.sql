create table if not exists public.travel_idea_collections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_idea_collections_title_not_blank check (char_length(btrim(title)) > 0)
);

create index if not exists travel_idea_collections_owner_user_id_idx
on public.travel_idea_collections(owner_user_id);

create index if not exists travel_idea_collections_owner_sort_created_idx
on public.travel_idea_collections(owner_user_id, sort_order, created_at);

drop trigger if exists set_travel_idea_collections_updated_at on public.travel_idea_collections;
create trigger set_travel_idea_collections_updated_at
before update on public.travel_idea_collections
for each row
execute function public.set_updated_at();

alter table public.travel_idea_collections enable row level security;

drop policy if exists "travel_idea_collections_owner_select" on public.travel_idea_collections;
create policy "travel_idea_collections_owner_select"
on public.travel_idea_collections
for select
using (owner_user_id = auth.uid());

drop policy if exists "travel_idea_collections_owner_insert" on public.travel_idea_collections;
create policy "travel_idea_collections_owner_insert"
on public.travel_idea_collections
for insert
with check (owner_user_id = auth.uid());

drop policy if exists "travel_idea_collections_owner_update" on public.travel_idea_collections;
create policy "travel_idea_collections_owner_update"
on public.travel_idea_collections
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

revoke all on table public.travel_idea_collections from public;
grant select, insert, update on table public.travel_idea_collections to authenticated;

create table if not exists public.travel_ideas (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid references public.travel_idea_collections(id) on delete set null,
  title text not null,
  url text,
  excerpt text,
  notes text,
  location_text text,
  price_amount numeric,
  price_currency text,
  semantic_type text not null default 'idea',
  source text not null default 'manual',
  status text not null default 'inbox',
  image_url text,
  image_alt text,
  image_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_ideas_title_not_blank check (char_length(btrim(title)) > 0),
  constraint travel_ideas_status_check check (status in ('inbox', 'archived')),
  constraint travel_ideas_source_check check (source in ('manual', 'link_intake', 'browser_extension', 'ai_recommendation')),
  constraint travel_ideas_price_non_negative check (price_amount is null or price_amount >= 0)
);

create index if not exists travel_ideas_owner_user_id_idx
on public.travel_ideas(owner_user_id);

create index if not exists travel_ideas_owner_status_created_idx
on public.travel_ideas(owner_user_id, status, created_at desc);

create index if not exists travel_ideas_owner_collection_status_created_idx
on public.travel_ideas(owner_user_id, collection_id, status, created_at desc);

create or replace function public.ensure_travel_idea_collection_owner()
returns trigger
language plpgsql
as $$
begin
  if new.collection_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.travel_idea_collections collection
    where collection.id = new.collection_id
      and collection.owner_user_id = new.owner_user_id
  ) then
    raise exception 'invalid_travel_idea_collection'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_travel_idea_collection_owner on public.travel_ideas;
create trigger ensure_travel_idea_collection_owner
before insert or update of owner_user_id, collection_id on public.travel_ideas
for each row
execute function public.ensure_travel_idea_collection_owner();

drop trigger if exists set_travel_ideas_updated_at on public.travel_ideas;
create trigger set_travel_ideas_updated_at
before update on public.travel_ideas
for each row
execute function public.set_updated_at();

alter table public.travel_ideas enable row level security;

drop policy if exists "travel_ideas_owner_select" on public.travel_ideas;
create policy "travel_ideas_owner_select"
on public.travel_ideas
for select
using (owner_user_id = auth.uid());

drop policy if exists "travel_ideas_owner_insert" on public.travel_ideas;
create policy "travel_ideas_owner_insert"
on public.travel_ideas
for insert
with check (owner_user_id = auth.uid());

drop policy if exists "travel_ideas_owner_update" on public.travel_ideas;
create policy "travel_ideas_owner_update"
on public.travel_ideas
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

revoke all on table public.travel_ideas from public;
grant select, insert, update on table public.travel_ideas to authenticated;
