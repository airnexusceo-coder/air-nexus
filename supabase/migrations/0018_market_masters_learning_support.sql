-- Market Masters replaced its old 3-way "game mode" (guided/challenge/sandbox)
-- with a dedicated learning-support preference (full/occasional/minimal/sandbox),
-- decoupled from difficulty and simulation speed. The `mode` column keeps its
-- name (it already means "how much teaching support the student wants") — only
-- the set of accepted values changes.

alter table public.market_masters_progress drop constraint if exists market_masters_progress_mode_check;
alter table public.market_masters_progress alter column mode set default 'full';
alter table public.market_masters_progress add constraint market_masters_progress_mode_check
  check (mode in ('full', 'occasional', 'minimal', 'sandbox'));
