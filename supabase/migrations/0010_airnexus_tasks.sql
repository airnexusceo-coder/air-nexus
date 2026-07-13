-- AirNexus — real personal study tasks. Replaces the Tasks page's hardcoded
-- 12-item in-memory seed array, which reset to the same fake data on every
-- reload and never persisted anything a student actually added or completed.
-- Personal (owner-only), distinct from the room-scoped public.room_tasks
-- table added in migration 0005.

create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null default 'General',
  priority text not null default 'Medium',
  status text not null default 'Todo',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_length check (char_length(title) between 1 and 200),
  constraint tasks_subject_length check (char_length(subject) between 1 and 80),
  constraint tasks_priority_check check (priority in ('High', 'Medium', 'Low')),
  constraint tasks_status_check check (status in ('Todo', 'In Progress', 'Done'))
);
create index if not exists tasks_user_id_idx on public.tasks(user_id, created_at desc);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "read own tasks" on public.tasks;
create policy "read own tasks" on public.tasks for select using (auth.uid() = user_id);

drop policy if exists "insert own tasks" on public.tasks;
create policy "insert own tasks" on public.tasks for insert with check (auth.uid() = user_id);

drop policy if exists "update own tasks" on public.tasks;
create policy "update own tasks" on public.tasks for update using (auth.uid() = user_id);

drop policy if exists "delete own tasks" on public.tasks;
create policy "delete own tasks" on public.tasks for delete using (auth.uid() = user_id);
