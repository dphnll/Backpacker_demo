create or replace function public.accept_expense_proposal(
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'owner_jwt_required');
  end if;

  return public.accept_expense_proposal(p_proposal_id, auth.uid());
end;
$$;

revoke all on function public.accept_expense_proposal(uuid, uuid) from public;
revoke all on function public.accept_expense_proposal(uuid, uuid) from anon;
revoke all on function public.accept_expense_proposal(uuid, uuid) from authenticated;

revoke all on function public.accept_expense_proposal(uuid) from public;
revoke all on function public.accept_expense_proposal(uuid) from anon;
grant execute on function public.accept_expense_proposal(uuid) to authenticated;
