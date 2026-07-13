-- AirNexus — real personal calendar events. Replaces the Calendar page's
-- hardcoded "June 2026" seed of 5 fake events (fixed to a 30-day month with
-- "today" pinned to the 22nd) with owner-scoped, persisted events tied to
-- real dates. Optionally links an event to a real row in public.tasks
-- (added in migration 0010), replacing the old decorative `task: true` flag.

create extension if not exists pgcrypto;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_type text not null default 'Study',
  event_date date not null,
  time_label text not null default 'Any time',
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_title_length check (char_length(title) between 1 and 200),
  constraint calendar_events_type_check check (event_type in ('Deadline', 'Exam', 'Study')),
  constraint calendar_events_time_length check (char_length(time_label) between 1 and 40)
);
create index if not exists calendar_events_user_id_idx on public.calendar_events(user_id, event_date);

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at before update on public.calendar_events
for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

drop policy if exists "read own calendar events" on public.calendar_events;
create policy "read own calendar events" on public.calendar_events for select using (auth.uid() = user_id);

drop policy if exists "insert own calendar events" on public.calendar_events;
create policy "insert own calendar events" on public.calendar_events for insert with check (auth.uid() = user_id);

drop policy if exists "update own calendar events" on public.calendar_events;
create policy "update own calendar events" on public.calendar_events for update using (auth.uid() = user_id);

drop policy if exists "delete own calendar events" on public.calendar_events;
create policy "delete own calendar events" on public.calendar_events for delete using (auth.uid() = user_id);
