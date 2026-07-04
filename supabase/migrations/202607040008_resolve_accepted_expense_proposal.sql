create or replace function public.resolve_accepted_expense_proposal(
  p_proposal_id uuid,
  p_actor_user_id uuid,
  p_next_status text
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
  filtered_participants jsonb := '[]'::jsonb;
  participant jsonb;
  item jsonb;
  items jsonb;
  updated_items jsonb := '[]'::jsonb;
  allocations jsonb;
  allocation jsonb;
  updated_allocations jsonb := '[]'::jsonb;
  now_value timestamptz := now();
  item_price numeric;
  amount numeric;
  author_participant_id text := '';
  target_participant_id text := '';
  author_amount numeric := 0;
  target_amount numeric := 0;
  allocation_sum numeric := 0;
  item_found boolean := false;
  target_still_used boolean := true;
begin
  if p_next_status not in ('rejected', 'withdrawn') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

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
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'share_not_found');
  end if;

  if p_next_status = 'rejected' and share.owner_user_id <> p_actor_user_id then
    return jsonb_build_object('ok', false, 'error', 'owner_required');
  end if;

  if p_next_status = 'withdrawn' and proposal.requester_user_id <> p_actor_user_id then
    return jsonb_build_object('ok', false, 'error', 'requester_required');
  end if;

  if proposal.status = p_next_status then
    return jsonb_build_object('ok', true, 'status', proposal.status, 'shareId', share.id, 'state', share.state, 'updatedAt', share.updated_at);
  end if;

  if proposal.status <> 'accepted' then
    return jsonb_build_object('ok', true, 'status', proposal.status, 'shareId', share.id, 'state', share.state, 'updatedAt', share.updated_at);
  end if;

  trip := coalesce(share.state->'trip', '{}'::jsonb);
  participants := coalesce(trip->'participants', '[]'::jsonb);
  items := coalesce(share.state->'items', '[]'::jsonb);
  amount := proposal.amount;

  select entry->>'id' into author_participant_id
  from jsonb_array_elements(participants) entry
  where coalesce((entry->>'isSelf')::boolean, false) is true
  limit 1;

  if coalesce(author_participant_id, '') = '' then
    select entry->>'id' into author_participant_id
    from jsonb_array_elements(participants) entry
    limit 1;
  end if;

  target_participant_id := coalesce(proposal.participant_id, '');
  if target_participant_id = '' then
    select participant_id into target_participant_id
    from public.trip_share_participant_links
    where trip_share_id = share.id
      and user_id = proposal.requester_user_id
    limit 1;
  end if;

  if coalesce(author_participant_id, '') = '' or coalesce(target_participant_id, '') = '' or amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'cannot_revert');
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
    updated_allocations := '[]'::jsonb;
    author_amount := 0;
    target_amount := 0;

    for allocation in select * from jsonb_array_elements(allocations)
    loop
      if allocation->>'participantId' = author_participant_id then
        author_amount := coalesce((allocation->>'amount')::numeric, 0);
      elsif allocation->>'participantId' = target_participant_id then
        target_amount := coalesce((allocation->>'amount')::numeric, 0);
      end if;
    end loop;

    if item_price <= 0 or target_amount < amount then
      return jsonb_build_object('ok', false, 'error', 'cannot_revert');
    end if;

    for allocation in select * from jsonb_array_elements(allocations)
    loop
      if allocation->>'participantId' = author_participant_id then
        updated_allocations := updated_allocations || jsonb_build_array(jsonb_set(allocation, '{amount}', to_jsonb(author_amount + amount)));
      elsif allocation->>'participantId' = target_participant_id then
        if target_amount - amount > 0 then
          updated_allocations := updated_allocations || jsonb_build_array(jsonb_set(allocation, '{amount}', to_jsonb(target_amount - amount)));
        end if;
      else
        updated_allocations := updated_allocations || jsonb_build_array(allocation);
      end if;
    end loop;

    if author_amount = 0 then
      updated_allocations := updated_allocations || jsonb_build_array(jsonb_build_object('participantId', author_participant_id, 'amount', amount));
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
    return jsonb_build_object('ok', false, 'error', 'cannot_revert');
  end if;

  if proposal.participant_mode = 'new' then
    select exists (
      select 1
      from jsonb_array_elements(updated_items) item_entry
      cross join lateral jsonb_array_elements(coalesce(item_entry->'allocations', '[]'::jsonb)) allocation_entry
      where allocation_entry->>'participantId' = target_participant_id
    ) into target_still_used;

    if target_still_used is not true then
      for participant in select * from jsonb_array_elements(participants)
      loop
        if participant->>'id' <> target_participant_id then
          filtered_participants := filtered_participants || jsonb_build_array(participant);
        end if;
      end loop;
      share.state := jsonb_set(share.state, '{trip,participants}', filtered_participants, true);
      delete from public.trip_share_participant_links
      where trip_share_id = share.id
        and participant_id = target_participant_id
        and user_id = proposal.requester_user_id;
    end if;
  end if;

  share.state := jsonb_set(share.state, '{items}', updated_items, true);

  update public.trip_share_expense_proposals
  set status = p_next_status, resolved_at = now_value
  where id = proposal.id;

  update public.trip_shares
  set state = share.state
  where id = share.id
  returning * into share;

  return jsonb_build_object('ok', true, 'status', p_next_status, 'shareId', share.id, 'state', share.state, 'updatedAt', share.updated_at);
end;
$$;

create or replace function public.resolve_accepted_expense_proposal(
  p_proposal_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'jwt_required');
  end if;

  return public.resolve_accepted_expense_proposal(p_proposal_id, auth.uid(), p_next_status);
end;
$$;

revoke all on function public.resolve_accepted_expense_proposal(uuid, uuid, text) from public;
revoke all on function public.resolve_accepted_expense_proposal(uuid, uuid, text) from anon;
revoke all on function public.resolve_accepted_expense_proposal(uuid, uuid, text) from authenticated;

revoke all on function public.resolve_accepted_expense_proposal(uuid, text) from public;
revoke all on function public.resolve_accepted_expense_proposal(uuid, text) from anon;
grant execute on function public.resolve_accepted_expense_proposal(uuid, text) to authenticated;
