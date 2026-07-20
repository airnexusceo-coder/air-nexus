-- AirGPT — Courses redesign: mastery-gated Area of Study study loop.
-- Replaces the old "pick a slide count" flow with one AI-generated slide
-- deck + one multiple-choice quiz per user/course/unit/area/calendar day.
-- A student must score 100% on a day's quiz to master that Area of Study;
-- otherwise the same area is re-taught (adaptively, see quiz_answers use in
-- lib/courses/area-sessions.ts) the next day. "Mastered" and all other
-- progress state are derived by querying this table — no separate
-- progress-summary table, so there is nothing that can get out of sync.

create table if not exists public.course_area_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  unit smallint not null check (unit between 1 and 4),
  area_id text not null,
  session_date date not null,
  slides jsonb not null,
  quiz jsonb not null,
  quiz_attempted boolean not null default false,
  quiz_score smallint,
  quiz_total smallint,
  quiz_passed boolean not null default false,
  quiz_answers jsonb,
  generated_by text not null default 'ai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_area_sessions_unique unique (user_id, course_id, unit, area_id, session_date)
);
create index if not exists course_area_sessions_lookup_idx on public.course_area_sessions(user_id, course_id, unit, area_id, session_date desc);

drop trigger if exists set_course_area_sessions_updated_at on public.course_area_sessions;
create trigger set_course_area_sessions_updated_at before update on public.course_area_sessions
for each row execute function public.set_updated_at();

alter table public.course_area_sessions enable row level security;

drop policy if exists "read own area sessions" on public.course_area_sessions;
create policy "read own area sessions" on public.course_area_sessions for select using (auth.uid() = user_id);

drop policy if exists "insert own area sessions" on public.course_area_sessions;
create policy "insert own area sessions" on public.course_area_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "update own area sessions" on public.course_area_sessions;
create policy "update own area sessions" on public.course_area_sessions for update using (auth.uid() = user_id);
