revoke all privileges
on table public.travel_idea_collections
from public, anon, authenticated;

revoke all privileges
on table public.travel_ideas
from public, anon, authenticated;

grant select, insert, update
on table public.travel_idea_collections
to authenticated;

grant select, insert, update
on table public.travel_ideas
to authenticated;
