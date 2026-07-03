create table if not exists public.trip_share_participant_links (
  id uuid primary key default gen_random_uuid(),
  trip_share_id uuid not null references public.trip_shares(id) on delete cascade,
  participant_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_share_participant_links_participant_unique unique (trip_share_id, participant_id),
  constraint trip_share_participant_links_user_unique unique (trip_share_id, user_id)
);

create index if not exists trip_share_participant_links_user_idx
on public.trip_share_participant_links(user_id);

drop trigger if exists set_trip_share_participant_links_updated_at on public.trip_share_participant_links;
create trigger set_trip_share_participant_links_updated_at
before update on public.trip_share_participant_links
for each row
execute function public.set_updated_at();

create table if not exists public.trip_share_expense_proposals (
  id uuid primary key default gen_random_uuid(),
  trip_share_id uuid not null references public.trip_shares(id) on delete cascade,
  trip_id text not null,
  item_id text not null,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  participant_mode text not null check (participant_mode in ('existing', 'new')),
  participant_id text,
  proposed_participant_name text,
  amount numeric not null check (amount > 0),
  currency text not null,
  financial_version text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'stale')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint trip_share_expense_proposals_participant_check check (
    (participant_mode = 'existing' and participant_id is not null and proposed_participant_name is null)
    or
    (participant_mode = 'new' and participant_id is null and proposed_participant_name is not null)
  )
);

create unique index if not exists trip_share_expense_proposals_pending_unique
on public.trip_share_expense_proposals(trip_share_id, requester_user_id, item_id)
where status = 'pending';

create index if not exists trip_share_expense_proposals_share_status_idx
on public.trip_share_expense_proposals(trip_share_id, status, created_at);

create index if not exists trip_share_expense_proposals_requester_idx
on public.trip_share_expense_proposals(requester_user_id, status, created_at);

drop trigger if exists set_trip_share_expense_proposals_updated_at on public.trip_share_expense_proposals;
create trigger set_trip_share_expense_proposals_updated_at
before update on public.trip_share_expense_proposals
for each row
execute function public.set_updated_at();

alter table public.trip_share_participant_links enable row level security;
alter table public.trip_share_expense_proposals enable row level security;

drop policy if exists "trip_share_participant_links_related_select" on public.trip_share_participant_links;
create policy "trip_share_participant_links_related_select"
on public.trip_share_participant_links
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.trip_shares s
    where s.id = trip_share_participant_links.trip_share_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "trip_share_expense_proposals_requester_select" on public.trip_share_expense_proposals;
create policy "trip_share_expense_proposals_requester_select"
on public.trip_share_expense_proposals
for select
using (
  requester_user_id = auth.uid()
  or exists (
    select 1
    from public.trip_shares s
    where s.id = trip_share_expense_proposals.trip_share_id
      and s.owner_user_id = auth.uid()
  )
);

create or replace function public.trip_share_expense_financial_version(
  p_trip_share_id uuid,
  p_state jsonb,
  p_item_id text,
  p_participant_id text,
  p_currency text
)
returns text
language plpgsql
stable
as $$
declare
  item jsonb;
  normalized_allocations jsonb;
  link_user text;
begin
  select entry into item
  from jsonb_array_elements(coalesce(p_state->'items', '[]'::jsonb)) entry
  where entry->>'id' = p_item_id
  limit 1;

  if item is null then
    return '';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'participantId', allocation->>'participantId',
    'amount', ((allocation->>'amount')::numeric)
  ) order by allocation->>'participantId'), '[]'::jsonb)
  into normalized_allocations
  from jsonb_array_elements(coalesce(item->'allocations', '[]'::jsonb)) allocation
  where coalesce(allocation->>'participantId', '') <> ''
    and coalesce((allocation->>'amount')::numeric, 0) > 0;

  select user_id::text into link_user
  from public.trip_share_participant_links
  where trip_share_id = p_trip_share_id
    and participant_id = p_participant_id
  limit 1;

  return encode(extensions.digest(jsonb_build_object(
    'itemId', item->>'id',
    'price', coalesce((item->>'price')::numeric, 0),
    'currency', p_currency,
    'allocations', coalesce(normalized_allocations, '[]'::jsonb),
    'participantId', coalesce(p_participant_id, ''),
    'participantLinkUserId', coalesce(link_user, '')
  )::text, 'sha256'), 'hex');
end;
$$;

create or replace function public.accept_expense_proposal(
  p_proposal_id uuid,
  p_owner_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.trip_share_expense_proposals%rowtype;
  share public.trip_shares%rowtype;
  trip jsonb;
  participants jsonb;
  participant jsonb;
  item jsonb;
  items jsonb;
  updated_items jsonb := '[]'::jsonb;
  allocations jsonb;
  allocation jsonb;
  updated_allocations jsonb := '[]'::jsonb;
  now_value timestamptz := now();
  currency text;
  item_price numeric;
  amount numeric;
  author_participant_id text := '';
  target_participant_id text := '';
  target_participant_name text := '';
  author_amount numeric := 0;
  target_amount numeric := 0;
  allocation_sum numeric := 0;
  item_found boolean := false;
  participant_found boolean := false;
  current_version text;
  color_keys text[] := array['orange', 'yellow', 'blue', 'teal', 'purple', 'pink'];
  participant_count integer := 0;
  link_user uuid;
  requester_link_participant_id text;
begin
  select * into proposal
  from public.trip_share_expense_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'proposal_not_found');
  end if;

  select * into share
  from public.trip_shares
  where id = proposal.trip_share_id
    and owner_user_id = p_owner_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'share_not_found');
  end if;

  if proposal.status = 'accepted' then
    return jsonb_build_object('ok', true, 'status', proposal.status, 'shareId', share.id, 'state', share.state, 'updatedAt', share.updated_at);
  end if;

  if proposal.status <> 'pending' then
    return jsonb_build_object('ok', true, 'status', proposal.status, 'shareId', share.id, 'state', share.state, 'updatedAt', share.updated_at);
  end if;

  if proposal.requester_user_id = share.owner_user_id
    or share.revoked_at is not null
    or share.include_budget is not true then
    update public.trip_share_expense_proposals
    set status = 'stale', resolved_at = now_value
    where id = proposal.id;
    return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
  end if;

  trip := coalesce(share.state->'trip', '{}'::jsonb);
  participants := coalesce(trip->'participants', '[]'::jsonb);
  items := coalesce(share.state->'items', '[]'::jsonb);
  currency := coalesce(trip->>'currency', '');
  amount := proposal.amount;
  participant_count := jsonb_array_length(participants);

  if currency <> proposal.currency or amount <= 0 then
    update public.trip_share_expense_proposals
    set status = 'stale', resolved_at = now_value
    where id = proposal.id;
    return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
  end if;

  select entry->>'id' into author_participant_id
  from jsonb_array_elements(participants) entry
  where coalesce((entry->>'isSelf')::boolean, false) is true
  limit 1;

  if coalesce(author_participant_id, '') = '' then
    select entry->>'id' into author_participant_id
    from jsonb_array_elements(participants) entry
    limit 1;
  end if;

  if proposal.participant_mode = 'existing' then
    target_participant_id := proposal.participant_id;
    select participant_id into requester_link_participant_id
    from public.trip_share_participant_links
    where trip_share_id = share.id
      and user_id = proposal.requester_user_id
    limit 1;

    if requester_link_participant_id is not null and requester_link_participant_id <> target_participant_id then
      update public.trip_share_expense_proposals
      set status = 'stale', resolved_at = now_value
      where id = proposal.id;
      return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
    end if;

    select entry into participant
    from jsonb_array_elements(participants) entry
    where entry->>'id' = target_participant_id
    limit 1;
    participant_found := participant is not null;

    select user_id into link_user
    from public.trip_share_participant_links
    where trip_share_id = share.id
      and participant_id = target_participant_id
    limit 1;

    if participant_found is not true or (link_user is not null and link_user <> proposal.requester_user_id) then
      update public.trip_share_expense_proposals
      set status = 'stale', resolved_at = now_value
      where id = proposal.id;
      return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
    end if;
  else
    select participant_id into requester_link_participant_id
    from public.trip_share_participant_links
    where trip_share_id = share.id
      and user_id = proposal.requester_user_id
    limit 1;

    if requester_link_participant_id is not null then
      update public.trip_share_expense_proposals
      set status = 'stale', resolved_at = now_value
      where id = proposal.id;
      return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
    end if;

    target_participant_name := btrim(coalesce(proposal.proposed_participant_name, ''));
    if target_participant_name = '' or char_length(target_participant_name) > 40 then
      update public.trip_share_expense_proposals
      set status = 'stale', resolved_at = now_value
      where id = proposal.id;
      return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
    end if;
    target_participant_id := 'participant-' || share.trip_id || '-' || replace(substr(gen_random_uuid()::text, 1, 8), '-', '');
  end if;

  current_version := public.trip_share_expense_financial_version(share.id, share.state, proposal.item_id, coalesce(proposal.participant_id, ''), proposal.currency);
  if current_version = '' or current_version <> proposal.financial_version then
    update public.trip_share_expense_proposals
    set status = 'stale', resolved_at = now_value
    where id = proposal.id;
    return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'financial_state_changed');
  end if;

  for item in select * from jsonb_array_elements(items)
  loop
    if item->>'id' <> proposal.item_id then
      updated_items := updated_items || jsonb_build_array(item);
      continue;
    end if;

    item_found := true;
    item_price := coalesce((item->>'price')::numeric, 0);
    allocations := coalesce(item->'allocations', '[]'::jsonb);

    if item_price <= 0 then
      update public.trip_share_expense_proposals
      set status = 'stale', resolved_at = now_value
      where id = proposal.id;
      return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
    end if;

    for allocation in select * from jsonb_array_elements(allocations)
    loop
      if allocation->>'participantId' = author_participant_id then
        author_amount := coalesce((allocation->>'amount')::numeric, 0);
      elsif allocation->>'participantId' = target_participant_id then
        target_amount := coalesce((allocation->>'amount')::numeric, 0);
      end if;
    end loop;

    if author_amount <= 0 or amount > author_amount then
      update public.trip_share_expense_proposals
      set status = 'stale', resolved_at = now_value
      where id = proposal.id;
      return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
    end if;

    for allocation in select * from jsonb_array_elements(allocations)
    loop
      if allocation->>'participantId' = author_participant_id then
        if author_amount - amount > 0 then
          updated_allocations := updated_allocations || jsonb_build_array(jsonb_set(allocation, '{amount}', to_jsonb(author_amount - amount)));
        end if;
      elsif allocation->>'participantId' = target_participant_id then
        updated_allocations := updated_allocations || jsonb_build_array(jsonb_set(allocation, '{amount}', to_jsonb(target_amount + amount)));
      else
        updated_allocations := updated_allocations || jsonb_build_array(allocation);
      end if;
    end loop;

    if target_amount = 0 then
      updated_allocations := updated_allocations || jsonb_build_array(jsonb_build_object('participantId', target_participant_id, 'amount', amount));
    end if;

    select coalesce(sum((entry->>'amount')::numeric), 0)
    into allocation_sum
    from jsonb_array_elements(updated_allocations) entry;

    if allocation_sum <> item_price then
      raise exception 'allocation invariant failed';
    end if;

    updated_items := updated_items || jsonb_build_array(jsonb_set(item, '{allocations}', updated_allocations));
  end loop;

  if item_found is not true then
    update public.trip_share_expense_proposals
    set status = 'stale', resolved_at = now_value
    where id = proposal.id;
    return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
  end if;

  if proposal.participant_mode = 'new' then
    participants := participants || jsonb_build_array(jsonb_build_object(
      'id', target_participant_id,
      'tripId', share.trip_id,
      'name', target_participant_name,
      'initials', upper(substr(target_participant_name, 1, 1)),
      'colorKey', color_keys[(participant_count % array_length(color_keys, 1)) + 1],
      'isSelf', false,
      'createdAt', now_value,
      'updatedAt', now_value
    ));
    share.state := jsonb_set(share.state, '{trip,participants}', participants, true);
  end if;

  share.state := jsonb_set(share.state, '{items}', updated_items, true);

  insert into public.trip_share_participant_links(trip_share_id, participant_id, user_id)
  values (share.id, target_participant_id, proposal.requester_user_id)
  on conflict (trip_share_id, participant_id) do update
  set user_id = excluded.user_id;

  update public.trip_share_expense_proposals
  set status = 'accepted', resolved_at = now_value
  where id = proposal.id;

  update public.trip_shares
  set state = share.state
  where id = share.id
  returning * into share;

  return jsonb_build_object('ok', true, 'status', 'accepted', 'shareId', share.id, 'state', share.state, 'updatedAt', share.updated_at);
end;
$$;
