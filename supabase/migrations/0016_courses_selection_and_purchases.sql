-- AirNexus — server-persisted Courses access, replacing localStorage-only
-- gating. Courses/units were previously "unlocked" purely by client state
-- (free-subject choice, Plus monthly pick) that the API routes never
-- checked — any authenticated user could generate any course's AI lesson
-- pack regardless of plan. This migration adds:
-- 1. course_selections — the free-subject choice and Plus monthly unit
--    pick, now server-persisted so the API can verify them.
-- 2. course_purchases — a real Nexus-Points-purchased course unlock, valid
--    until the next school holiday break (self-reported spend, same trust
--    model this app already uses for Nexus Points everywhere else — see
--    lib/apex/vault/technologies.ts's existing note on this).

create extension if not exists pgcrypto;

create table if not exists public.course_selections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_subject_course_id text,
  plus_month_key text,
  plus_course_id text,
  plus_unit smallint,
  updated_at timestamptz not null default now(),
  constraint course_selections_plus_unit_check check (plus_unit is null or plus_unit between 1 and 4)
);

drop trigger if exists set_course_selections_updated_at on public.course_selections;
create trigger set_course_selections_updated_at before update on public.course_selections
for each row execute function public.set_updated_at();

create table if not exists public.course_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  points_spent integer not null,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint course_purchases_points_nonneg check (points_spent >= 0)
);
create index if not exists course_purchases_user_idx on public.course_purchases(user_id, course_id);

alter table public.course_selections enable row level security;
alter table public.course_purchases enable row level security;

drop policy if exists "read own course selection" on public.course_selections;
create policy "read own course selection" on public.course_selections for select using (auth.uid() = user_id);
drop policy if exists "upsert own course selection" on public.course_selections;
create policy "upsert own course selection" on public.course_selections for insert with check (auth.uid() = user_id);
drop policy if exists "update own course selection" on public.course_selections;
create policy "update own course selection" on public.course_selections for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read own course purchases" on public.course_purchases;
create policy "read own course purchases" on public.course_purchases for select using (auth.uid() = user_id);
drop policy if exists "create own course purchase" on public.course_purchases;
create policy "create own course purchase" on public.course_purchases for insert with check (auth.uid() = user_id);
