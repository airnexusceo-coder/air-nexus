-- AirNexus — three additive changes:
-- 1. Established, open ("system") Collaboration Rooms — one per VCE subject,
--    each with two sub-channels ("Units 1 & 2" / "Units 3 & 4"). System rooms
--    have no room_members rows (nobody has to be individually invited); RLS
--    is extended so any authenticated student can read/post in a room where
--    rooms.is_system = true, alongside the existing membership-based access
--    for regular (admin-created) rooms.
-- 2. profiles.username — a real, unique handle, replacing "real name" as the
--    thing collected at signup and shown everywhere display_name already
--    renders. display_name keeps its existing shape/constraints (no call
--    site elsewhere needs to change) but is now sourced from the username
--    the student chose, not a full legal name.
-- 3. airnexus_find_profile_by_email — exact-match-only email lookup for
--    Player Discovery, replacing name-based fuzzy search. Same trust model
--    as the existing airnexus_send_friend_request(target_email): the caller
--    must already know the full email, so this cannot be used to browse or
--    enumerate students by typing partial real names.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1a. System rooms + sub-channels
-- ---------------------------------------------------------------------------

alter table public.rooms add column if not exists is_system boolean not null default false;
alter table public.rooms alter column created_by drop not null;

create table if not exists public.room_channels (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint room_channels_name_length check (char_length(name) between 1 and 80)
);
create index if not exists room_channels_room_idx on public.room_channels(room_id, position);

alter table public.room_messages add column if not exists channel_id uuid references public.room_channels(id) on delete set null;
create index if not exists room_messages_channel_idx on public.room_messages(channel_id, created_at);

alter table public.room_channels enable row level security;

drop policy if exists "read room channels" on public.room_channels;
create policy "read room channels" on public.room_channels for select using (
  exists (select 1 from public.rooms r where r.id = room_channels.room_id and r.is_system)
  or exists (select 1 from public.room_members m where m.room_id = room_channels.room_id and m.user_id = auth.uid())
);

-- Extend room/message/task access to cover open system rooms, alongside the
-- existing membership-based access for regular rooms (unchanged).
drop policy if exists "read my rooms" on public.rooms;
create policy "read my rooms" on public.rooms for select using (
  is_system
  or exists (select 1 from public.room_members m where m.room_id = rooms.id and m.user_id = auth.uid())
);

drop policy if exists "read room messages" on public.room_messages;
create policy "read room messages" on public.room_messages for select using (
  exists (select 1 from public.rooms r where r.id = room_messages.room_id and r.is_system)
  or exists (select 1 from public.room_members m where m.room_id = room_messages.room_id and m.user_id = auth.uid())
);

drop policy if exists "post room messages" on public.room_messages;
create policy "post room messages" on public.room_messages for insert with check (
  sender_id = auth.uid()
  and (
    exists (select 1 from public.rooms r where r.id = room_messages.room_id and r.is_system)
    or exists (select 1 from public.room_members m where m.room_id = room_messages.room_id and m.user_id = auth.uid())
  )
);

drop policy if exists "manage room tasks" on public.room_tasks;
create policy "manage room tasks" on public.room_tasks for all using (
  exists (select 1 from public.rooms r where r.id = room_tasks.room_id and r.is_system)
  or exists (select 1 from public.room_members m where m.room_id = room_tasks.room_id and m.user_id = auth.uid())
) with check (
  exists (select 1 from public.rooms r where r.id = room_tasks.room_id and r.is_system)
  or exists (select 1 from public.room_members m where m.room_id = room_tasks.room_id and m.user_id = auth.uid())
);

-- Seed: one open room per VCE subject, each with two unit-level channels.
-- Idempotent by name+is_system lookup (no unique constraint on rooms.name).
do $$
declare
  v_subject text;
  v_room_id uuid;
  v_subjects text[] := array[
    'English', 'English Language', 'Literature', 'Mathematical Methods', 'Specialist Mathematics',
    'General Mathematics', 'Chemistry', 'Physics', 'Biology', 'Economics', 'Accounting',
    'Business Management', 'Legal Studies', 'Psychology', 'History: Revolutions',
    'Health and Human Development', 'Physical Education', 'French'
  ];
begin
  foreach v_subject in array v_subjects loop
    select id into v_room_id from public.rooms where name = v_subject and is_system limit 1;
    if v_room_id is null then
      insert into public.rooms (name, created_by, is_system) values (v_subject, null, true) returning id into v_room_id;
    end if;
    if not exists (select 1 from public.room_channels where room_id = v_room_id) then
      insert into public.room_channels (room_id, name, position) values
        (v_room_id, 'Units 1 & 2', 1),
        (v_room_id, 'Units 3 & 4', 2);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 1b. Server-only rooms path used by the API layer (SECURITY DEFINER so it
-- can populate display names / room metadata regardless of RLS scoping,
-- mirrors the existing pattern used throughout this file for other RPCs).
-- No new function needed here — the app reads rooms/room_channels directly
-- with the caller's own token, now that RLS covers system rooms above.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2. Username — replaces "real name" as what's collected at signup and shown
-- everywhere display_name already renders (no other call site changes).
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists username text;

-- Backfill existing accounts with a derived, deduplicated username.
do $$
declare
  rec record;
  v_base text;
  v_candidate text;
  v_suffix int;
begin
  for rec in select user_id, display_name from public.profiles where username is null order by created_at asc loop
    v_base := trim(both '_' from regexp_replace(lower(rec.display_name), '[^a-z0-9_]+', '_', 'g'));
    if v_base is null or char_length(v_base) < 3 then
      v_base := 'student_' || substr(replace(rec.user_id::text, '-', ''), 1, 8);
    end if;
    v_base := substr(v_base, 1, 20);
    v_candidate := v_base;
    v_suffix := 1;
    while exists (select 1 from public.profiles where username = v_candidate) loop
      v_suffix := v_suffix + 1;
      v_candidate := substr(v_base, 1, greatest(1, 20 - char_length(v_suffix::text) - 1)) || '_' || v_suffix;
    end loop;
    update public.profiles set username = v_candidate where user_id = rec.user_id;
  end loop;
end $$;

alter table public.profiles alter column username set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_unique') then
    alter table public.profiles add constraint profiles_username_unique unique (username);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$');
  end if;
end $$;

-- Bootstrap trigger: collects a username (falls back to the email's local
-- part, then a random handle) instead of a full legal name. display_name
-- keeps its existing shape (still what every other function/UI reads) but is
-- now sourced from the chosen username, deduplicated the same way.
create or replace function public.ensure_airnexus_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  starter integer := public.airnexus_starter_air();
  v_raw_name text;
  v_base text;
  v_candidate text;
  v_suffix int := 1;
begin
  v_raw_name := trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'AirNexus student'));
  if v_raw_name = '' then v_raw_name := 'AirNexus student'; end if;

  v_base := trim(both '_' from regexp_replace(lower(v_raw_name), '[^a-z0-9_]+', '_', 'g'));
  if v_base is null or char_length(v_base) < 3 then
    v_base := 'student_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  v_base := substr(v_base, 1, 20);
  v_candidate := v_base;
  while exists (select 1 from public.profiles where username = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := substr(v_base, 1, greatest(1, 20 - char_length(v_suffix::text) - 1)) || '_' || v_suffix;
  end loop;

  insert into public.profiles (user_id, display_name, username)
  values (new.id, substr(v_raw_name, 1, 80), v_candidate)
  on conflict (user_id) do nothing;

  insert into public.air_wallets (user_id, balance)
  values (new.id, starter)
  on conflict (user_id) do nothing;

  insert into public.apex_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Email-only person lookup — exact match, never partial/fuzzy, so it can
-- never be used to enumerate or browse students by name.
-- ---------------------------------------------------------------------------

create or replace function public.airnexus_find_profile_by_email(p_email text)
returns table (
  user_id uuid,
  display_name text,
  apex_xp bigint,
  is_friend boolean,
  is_following boolean,
  friendship_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    coalesce(ap.apex_xp, 0) as apex_xp,
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = p.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = p.user_id))
    ) as is_friend,
    exists (
      select 1 from public.follows fo where fo.follower_id = auth.uid() and fo.followed_id = p.user_id
    ) as is_following,
    (
      select f.status from public.friendships f
      where f.status in ('pending', 'accepted')
        and ((f.requester_id = auth.uid() and f.addressee_id = p.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = p.user_id))
      limit 1
    ) as friendship_status
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.apex_profiles ap on ap.user_id = p.user_id
  where p.user_id <> auth.uid()
    and p_email is not null
    and length(trim(p_email)) >= 3
    and lower(u.email) = lower(trim(p_email));
$$;

revoke all on function public.airnexus_find_profile_by_email(text) from public, anon;
grant execute on function public.airnexus_find_profile_by_email(text) to authenticated;
