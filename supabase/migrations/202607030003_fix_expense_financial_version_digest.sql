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
