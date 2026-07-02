create table if not exists public.trip_share_recipients (
  id uuid primary key default gen_random_uuid(),
  trip_share_id uuid not null references public.trip_shares(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint trip_share_recipients_unique unique (trip_share_id, recipient_user_id)
);

create index if not exists trip_share_recipients_user_idx
on public.trip_share_recipients(recipient_user_id)
where removed_at is null;

create index if not exists trip_share_recipients_share_idx
on public.trip_share_recipients(trip_share_id);

alter table public.trip_share_recipients enable row level security;

drop policy if exists "trip_share_recipients_own_select" on public.trip_share_recipients;
create policy "trip_share_recipients_own_select"
on public.trip_share_recipients
for select
using (recipient_user_id = auth.uid());

drop policy if exists "trip_share_recipients_own_insert" on public.trip_share_recipients;
create policy "trip_share_recipients_own_insert"
on public.trip_share_recipients
for insert
with check (recipient_user_id = auth.uid());

drop policy if exists "trip_share_recipients_own_update" on public.trip_share_recipients;
create policy "trip_share_recipients_own_update"
on public.trip_share_recipients
for update
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());
