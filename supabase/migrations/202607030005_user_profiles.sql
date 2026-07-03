create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_display_name_length check (
    char_length(display_name) between 1 and 40
  ),
  constraint user_profiles_display_name_no_control check (
    display_name !~ '[[:cntrl:]]'
  ),
  constraint user_profiles_display_name_trimmed check (
    display_name = btrim(display_name)
  )
);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_own_select" on public.user_profiles;
create policy "user_profiles_own_select"
on public.user_profiles
for select
using (user_id = auth.uid());

drop policy if exists "user_profiles_own_insert" on public.user_profiles;
create policy "user_profiles_own_insert"
on public.user_profiles
for insert
with check (user_id = auth.uid());

drop policy if exists "user_profiles_own_update" on public.user_profiles;
create policy "user_profiles_own_update"
on public.user_profiles
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on table public.user_profiles from public;
grant select, insert, update on table public.user_profiles to authenticated;
