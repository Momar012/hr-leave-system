-- chat_threads: one row per conversation thread
create table public.chat_threads (
  id uuid default uuid_generate_v4() primary key,
  employee_id uuid references public.profiles(id) on delete cascade not null,
  title text not null default 'New conversation',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.chat_threads enable row level security;
create policy "Employees own threads" on public.chat_threads
  for all using (auth.uid() = employee_id) with check (auth.uid() = employee_id);

-- chat_messages: messages within a thread
create table public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  thread_id uuid references public.chat_threads(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
alter table public.chat_messages enable row level security;
create policy "Employees own messages" on public.chat_messages
  for all using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.employee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.employee_id = auth.uid()
    )
  );
