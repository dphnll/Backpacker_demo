drop policy if exists "trip_share_item_proposals_requester_insert" on public.trip_share_item_proposals;
drop policy if exists "trip_share_item_proposals_requester_withdraw" on public.trip_share_item_proposals;

revoke insert, update, delete on public.trip_share_item_proposals from anon;
revoke insert, update, delete on public.trip_share_item_proposals from authenticated;
