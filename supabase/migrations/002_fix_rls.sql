-- Fix infinite recursion in RLS policies
-- The "Managers can view all profiles" policy was querying profiles FROM WITHIN
-- a profiles policy, causing infinite recursion.
-- Solution: use a security definer function that bypasses RLS.

-- 1. Create a helper function that checks if the current user is a manager
--    (security definer = runs as the function owner, bypasses RLS)
create or replace function public.is_manager()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

-- 2. Drop the recursive policy on profiles
drop policy if exists "Managers can view all profiles" on public.profiles;

-- 3. Re-create it using the helper function (no recursion)
create policy "Managers can view all profiles"
  on public.profiles for select
  using (public.is_manager());

-- 4. Fix leave_balances manager policies
drop policy if exists "Managers can view all balances" on public.leave_balances;
drop policy if exists "Managers can update balances" on public.leave_balances;

create policy "Managers can view all balances"
  on public.leave_balances for select
  using (public.is_manager());

create policy "Managers can update balances"
  on public.leave_balances for update
  using (public.is_manager());

-- 5. Fix leave_requests manager policies
drop policy if exists "Managers can view all requests" on public.leave_requests;
drop policy if exists "Managers can update request status" on public.leave_requests;

create policy "Managers can view all requests"
  on public.leave_requests for select
  using (public.is_manager());

create policy "Managers can update request status"
  on public.leave_requests for update
  using (public.is_manager());

-- 6. Fix notifications manager policies
drop policy if exists "Managers can view all notifications" on public.notifications;
drop policy if exists "Managers can update notifications" on public.notifications;

create policy "Managers can view all notifications"
  on public.notifications for select
  using (public.is_manager());

create policy "Managers can update notifications"
  on public.notifications for update
  using (public.is_manager());
