-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('employee', 'manager')),
  created_at timestamptz default now()
);

-- RLS for profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Managers can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

-- ============================================================
-- LEAVE BALANCES TABLE
-- ============================================================
create table public.leave_balances (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.profiles(id) on delete cascade not null,
  year int not null,
  casual_remaining int default 12 not null,
  annual_remaining int default 14 not null,
  medical_remaining int default 10 not null,
  sick_remaining int default 10 not null,
  half_day_remaining int default 6 not null,
  unique(employee_id, year)
);

-- RLS for leave_balances
alter table public.leave_balances enable row level security;

create policy "Employees can view their own balance"
  on public.leave_balances for select
  using (auth.uid() = employee_id);

create policy "Managers can view all balances"
  on public.leave_balances for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

create policy "Managers can update balances"
  on public.leave_balances for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

-- ============================================================
-- LEAVE REQUESTS TABLE
-- ============================================================
create table public.leave_requests (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.profiles(id) on delete cascade not null,
  leave_type text not null check (leave_type in ('casual', 'annual', 'medical', 'sick', 'half_day')),
  start_date date not null,
  end_date date not null,
  is_half_day boolean default false,
  working_days int not null,
  ai_generated_message text,
  employee_note text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- RLS for leave_requests
alter table public.leave_requests enable row level security;

create policy "Employees can view their own requests"
  on public.leave_requests for select
  using (auth.uid() = employee_id);

create policy "Employees can insert their own requests"
  on public.leave_requests for insert
  with check (auth.uid() = employee_id);

create policy "Managers can view all requests"
  on public.leave_requests for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

create policy "Managers can update request status"
  on public.leave_requests for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  leave_request_id uuid references public.leave_requests(id) on delete cascade not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- RLS for notifications
alter table public.notifications enable row level security;

create policy "Managers can view all notifications"
  on public.notifications for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

create policy "Managers can update notifications"
  on public.notifications for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

create policy "Employees can insert notifications"
  on public.notifications for insert
  with check (
    exists (
      select 1 from public.leave_requests lr
      where lr.id = leave_request_id and lr.employee_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTION: Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- FUNCTION: Auto-create leave balance on profile create
-- ============================================================
create or replace function public.handle_new_profile()
returns trigger as $$
begin
  if new.role = 'employee' then
    insert into public.leave_balances (employee_id, year)
    values (new.id, extract(year from now())::int);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();
