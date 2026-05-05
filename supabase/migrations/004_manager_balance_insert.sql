-- Allow managers to insert leave_balance rows
-- (needed for upsert when no row exists yet for a given year)
create policy "Managers can insert balances"
  on public.leave_balances for insert
  with check (public.is_manager());
