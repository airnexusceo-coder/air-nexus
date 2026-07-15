-- Market Masters is otherwise entirely localStorage-only (game state never
-- needs to leave the browser to be fair/functional). This table adds a
-- single opt-in exception: a self-reported *summary* snapshot of each
-- student's learning progress, synced opportunistically from the client, so
-- an admin/teacher can see class-wide progress without a client having to
-- expose its full game state. Same trust model as lifetime_points and course
-- selections elsewhere in this app — self-reported, server-persisted, not a
-- new category of dishonesty.

create table if not exists public.market_masters_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day integer not null default 0,
  portfolio_value numeric not null default 10000,
  return_percent numeric not null default 0,
  lessons_completed integer not null default 0,
  lessons_total integer not null default 0,
  missions_completed integer not null default 0,
  missions_total integer not null default 0,
  achievements_unlocked integer not null default 0,
  diversification_score integer not null default 0,
  decision_quality_rate numeric,
  misleading_news_identified integer not null default 0,
  reflections jsonb not null default '[]'::jsonb,
  mode text not null default 'guided',
  updated_at timestamptz not null default now(),
  constraint market_masters_progress_mode_check check (mode in ('guided', 'challenge', 'sandbox'))
);

drop trigger if exists set_market_masters_progress_updated_at on public.market_masters_progress;
create trigger set_market_masters_progress_updated_at before update on public.market_masters_progress
for each row execute function public.set_updated_at();

alter table public.market_masters_progress enable row level security;

drop policy if exists "read own market masters progress" on public.market_masters_progress;
create policy "read own market masters progress" on public.market_masters_progress for select using (auth.uid() = user_id);
drop policy if exists "create own market masters progress" on public.market_masters_progress;
create policy "create own market masters progress" on public.market_masters_progress for insert with check (auth.uid() = user_id);
drop policy if exists "update own market masters progress" on public.market_masters_progress;
create policy "update own market masters progress" on public.market_masters_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
