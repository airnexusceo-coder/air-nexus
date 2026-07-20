-- AirGPT — merges the Assignment Workspace into Tasks: a task can now
-- optionally carry a full AI-generated assignment plan (brief, checklist,
-- timeline, research, draft, references, review), one-to-one with the task
-- it belongs to. Replaces the old localStorage-only assignment storage.

create table if not exists public.task_assignments (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  brief text not null default '',
  source_notes text not null default '',
  target_word_count integer not null default 1000,
  checklist jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  research_notes jsonb not null default '[]'::jsonb,
  draft text not null default '',
  "references" jsonb not null default '[]'::jsonb,
  improvement_suggestions jsonb not null default '[]'::jsonb,
  final_review jsonb not null default '[]'::jsonb,
  stage_done jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists task_assignments_user_id_idx on public.task_assignments(user_id);

drop trigger if exists set_task_assignments_updated_at on public.task_assignments;
create trigger set_task_assignments_updated_at before update on public.task_assignments
for each row execute function public.set_updated_at();

alter table public.task_assignments enable row level security;

drop policy if exists "read own task assignments" on public.task_assignments;
create policy "read own task assignments" on public.task_assignments for select using (auth.uid() = user_id);

drop policy if exists "insert own task assignments" on public.task_assignments;
create policy "insert own task assignments" on public.task_assignments for insert with check (auth.uid() = user_id);

drop policy if exists "update own task assignments" on public.task_assignments;
create policy "update own task assignments" on public.task_assignments for update using (auth.uid() = user_id);

-- Priority <-> notifications sync: a personal task (public.tasks) can now
-- generate its own notifications (high-priority created, due soon). The
-- existing task_id column stays pointed at room_tasks (unrelated feature);
-- this adds a second, distinct FK column for personal tasks rather than
-- widening the existing constraint, so nothing about room-task notifications
-- changes.
alter table public.notifications add column if not exists personal_task_id uuid references public.tasks(id) on delete cascade;
create index if not exists notifications_personal_task_id_idx on public.notifications(personal_task_id);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('room_invite', 'task_assigned', 'task_completed', 'task_high_priority', 'task_due_soon'));
