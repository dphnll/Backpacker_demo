create table if not exists public.trip_share_item_proposals (
  id uuid primary key default gen_random_uuid(),
  trip_share_id uuid not null references public.trip_shares(id) on delete cascade,
  trip_id text not null,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  item_type text not null,
  link text,
  price numeric check (price is null or price >= 0),
  currency text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'stale')),
  idempotency_key text,
  accepted_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists trip_share_item_proposals_share_status_idx
on public.trip_share_item_proposals(trip_share_id, status, created_at);

create index if not exists trip_share_item_proposals_requester_idx
on public.trip_share_item_proposals(requester_user_id, status, created_at);

create index if not exists trip_share_item_proposals_trip_status_idx
on public.trip_share_item_proposals(trip_id, status, created_at);

create unique index if not exists trip_share_item_proposals_idempotency_unique
on public.trip_share_item_proposals(requester_user_id, idempotency_key)
where idempotency_key is not null;

drop trigger if exists set_trip_share_item_proposals_updated_at on public.trip_share_item_proposals;
create trigger set_trip_share_item_proposals_updated_at
before update on public.trip_share_item_proposals
for each row
execute function public.set_updated_at();

alter table public.trip_share_item_proposals enable row level security;

drop policy if exists "trip_share_item_proposals_related_select" on public.trip_share_item_proposals;
create policy "trip_share_item_proposals_related_select"
on public.trip_share_item_proposals
for select
using (
  requester_user_id = auth.uid()
  or exists (
    select 1
    from public.trip_shares s
    where s.id = trip_share_item_proposals.trip_share_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "trip_share_item_proposals_requester_insert" on public.trip_share_item_proposals;
drop policy if exists "trip_share_item_proposals_requester_withdraw" on public.trip_share_item_proposals;

revoke insert, update, delete on public.trip_share_item_proposals from anon;
revoke insert, update, delete on public.trip_share_item_proposals from authenticated;

create or replace function public.accept_item_proposal(
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid := auth.uid();
  proposal public.trip_share_item_proposals%rowtype;
  share public.trip_shares%rowtype;
  trip jsonb;
  participants jsonb;
  items jsonb;
  new_item jsonb;
  allocations jsonb := '[]'::jsonb;
  now_value timestamptz := now();
  v_accepted_item_id uuid;
  author_participant_id text := '';
  price numeric := 0;
  next_order integer := 0;
begin
  if v_owner_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'owner_jwt_required');
  end if;

  select * into proposal
  from public.trip_share_item_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'proposal_not_found');
  end if;

  select * into share
  from public.trip_shares
  where id = proposal.trip_share_id
    and owner_user_id = v_owner_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'share_not_found');
  end if;

  if proposal.status = 'accepted' then
    return jsonb_build_object(
      'ok', true,
      'status', 'accepted',
      'shareId', share.id,
      'acceptedItemId', proposal.accepted_item_id,
      'state', share.state,
      'updatedAt', share.updated_at
    );
  end if;

  if proposal.status <> 'pending' then
    return jsonb_build_object(
      'ok', true,
      'status', proposal.status,
      'shareId', share.id,
      'state', share.state,
      'updatedAt', share.updated_at
    );
  end if;

  if proposal.requester_user_id = share.owner_user_id
    or share.revoked_at is not null
    or share.state is null
    or coalesce(proposal.title, '') = ''
    or coalesce(proposal.currency, '') <> coalesce(share.state->'trip'->>'currency', '') then
    update public.trip_share_item_proposals
    set status = 'stale', resolved_at = now_value
    where id = proposal.id;
    return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
  end if;

  trip := coalesce(share.state->'trip', '{}'::jsonb);
  participants := coalesce(trip->'participants', '[]'::jsonb);
  items := coalesce(share.state->'items', '[]'::jsonb);
  price := coalesce(proposal.price, 0);

  select entry->>'id' into author_participant_id
  from jsonb_array_elements(participants) entry
  where coalesce((entry->>'isSelf')::boolean, false) is true
  limit 1;

  if coalesce(author_participant_id, '') = '' then
    select entry->>'id' into author_participant_id
    from jsonb_array_elements(participants) entry
    limit 1;
  end if;

  if price > 0 and coalesce(author_participant_id, '') = '' then
    update public.trip_share_item_proposals
    set status = 'stale', resolved_at = now_value
    where id = proposal.id;
    return jsonb_build_object('ok', true, 'status', 'stale', 'reason', 'proposal_stale');
  end if;

  if price > 0 then
    allocations := jsonb_build_array(jsonb_build_object('participantId', author_participant_id, 'amount', price));
  end if;

  select coalesce(max(coalesce((entry->>'order')::integer, 0)), -1) + 1
  into next_order
  from jsonb_array_elements(items) entry
  where coalesce(entry->>'date', '') = '';

  v_accepted_item_id := gen_random_uuid();
  new_item := jsonb_build_object(
    'id', v_accepted_item_id::text,
    'tripId', share.trip_id,
    'title', proposal.title,
    'type', proposal.item_type,
    'status', 'want',
    'priority', 'nice',
    'date', '',
    'startTime', '',
    'durationMinutes', 0,
    'price', price,
    'paidAmount', 0,
    'participantId', author_participant_id,
    'allocations', allocations,
    'link', coalesce(proposal.link, ''),
    'locationText', '',
    'notes', coalesce(proposal.notes, ''),
    'order', next_order,
    'creationSource', 'accepted_proposal',
    'sourceProposalId', proposal.id::text,
    'proposedByUserId', proposal.requester_user_id::text,
    'proposedByDisplayName', coalesce((
      select display_name
      from public.user_profiles
      where user_id = proposal.requester_user_id
      limit 1
    ), ''),
    'createdAt', now_value,
    'updatedAt', now_value
  );

  share.state := jsonb_set(share.state, '{items}', items || jsonb_build_array(new_item), true);

  update public.trip_share_item_proposals
  set status = 'accepted',
      accepted_item_id = v_accepted_item_id,
      resolved_at = now_value
  where id = proposal.id;

  update public.trip_shares
  set state = share.state
  where id = share.id
  returning * into share;

  return jsonb_build_object(
    'ok', true,
    'status', 'accepted',
    'shareId', share.id,
    'acceptedItemId', v_accepted_item_id,
    'state', share.state,
    'updatedAt', share.updated_at
  );
end;
$$;

revoke all on function public.accept_item_proposal(uuid) from public;
revoke all on function public.accept_item_proposal(uuid) from anon;
grant execute on function public.accept_item_proposal(uuid) to authenticated;
