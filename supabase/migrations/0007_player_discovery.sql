-- AirNexus — Player Discovery: search, public profiles, one-directional follows.
-- Reuses the existing friend graph (0002) and Apex XP/achievements (0002/0004)
-- rather than inventing parallel systems. Two new SECURITY DEFINER functions
-- are the only way a non-friend's profile becomes visible at all — profiles
-- RLS otherwise only allows reading your own row + accepted friends' rows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Follows: one-directional, no approval needed — distinct from friendships,
-- which are mutual and request-based. Follow relationships are public-facing
-- (like most social products) and reveal nothing sensitive, so a plain
-- public-read policy is safe here, unlike the private friend graph.
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_no_self check (follower_id <> followed_id)
);
create index if not exists follows_followed_idx on public.follows(followed_id);

alter table public.follows enable row level security;

drop policy if exists "read follows" on public.follows;
create policy "read follows" on public.follows for select to authenticated using (true);

drop policy if exists "create own follow" on public.follows;
create policy "create own follow" on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "remove own follow" on public.follows;
create policy "remove own follow" on public.follows for delete using (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- Self-reported, client-computed study stats (lib/motivation.ts), persisted
-- so a public profile can show them. Same trust model this app already uses
-- for Nexus Points — the client computes it, the server just stores/serves
-- it. Additive to the existing profiles table (0002).
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists lifetime_xp integer not null default 0;
alter table public.profiles add column if not exists current_streak_days integer not null default 0;
alter table public.profiles add column if not exists longest_streak_days integer not null default 0;
alter table public.profiles add column if not exists stats_synced_at timestamptz;

-- ---------------------------------------------------------------------------
-- airnexus_search_profiles — the one place a non-friend becomes discoverable
-- by name. Deliberately returns only display_name + already-public Apex XP +
-- relationship flags — never email, never anything profiles RLS wouldn't
-- otherwise allow a friend to see.
-- ---------------------------------------------------------------------------

create or replace function public.airnexus_search_profiles(p_query text)
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
  left join public.apex_profiles ap on ap.user_id = p.user_id
  where p.user_id <> auth.uid()
    and p_query is not null
    and length(trim(p_query)) >= 1
    and p.display_name ilike '%' || trim(p_query) || '%'
  order by p.display_name asc
  limit 20;
$$;

revoke all on function public.airnexus_search_profiles(text) from public, anon;
grant execute on function public.airnexus_search_profiles(text) to authenticated;

-- ---------------------------------------------------------------------------
-- airnexus_public_profile — everything a profile view needs in one call.
-- friendship_status intentionally never surfaces 'blocked' to the viewer —
-- same privacy reasoning as above, being blocked stays invisible to the
-- blocked party, matching how the rest of the friend system already behaves.
-- ---------------------------------------------------------------------------

create or replace function public.airnexus_public_profile(p_target_user_id uuid)
returns table (
  user_id uuid,
  display_name text,
  apex_xp bigint,
  lifetime_xp integer,
  current_streak_days integer,
  longest_streak_days integer,
  stats_synced_at timestamptz,
  is_friend boolean,
  is_following boolean,
  is_followed_by boolean,
  friendship_status text,
  follower_count bigint,
  following_count bigint
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
    p.lifetime_xp,
    p.current_streak_days,
    p.longest_streak_days,
    p.stats_synced_at,
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = p.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = p.user_id))
    ) as is_friend,
    exists (select 1 from public.follows fo where fo.follower_id = auth.uid() and fo.followed_id = p.user_id) as is_following,
    exists (select 1 from public.follows fo where fo.follower_id = p.user_id and fo.followed_id = auth.uid()) as is_followed_by,
    (
      select f.status from public.friendships f
      where f.status in ('pending', 'accepted')
        and ((f.requester_id = auth.uid() and f.addressee_id = p.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = p.user_id))
      limit 1
    ) as friendship_status,
    (select count(*) from public.follows fo where fo.followed_id = p.user_id) as follower_count,
    (select count(*) from public.follows fo where fo.follower_id = p.user_id) as following_count
  from public.profiles p
  left join public.apex_profiles ap on ap.user_id = p.user_id
  where p.user_id = p_target_user_id;
$$;

revoke all on function public.airnexus_public_profile(uuid) from public, anon;
grant execute on function public.airnexus_public_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- airnexus_send_friend_request_by_id — same rules as the existing
-- airnexus_send_friend_request (0002), but keyed by user id instead of
-- email. Needed because search/profile results deliberately never expose
-- email (see airnexus_search_profiles above) — "Add Friend" from a profile
-- has no email to send.
-- ---------------------------------------------------------------------------

create or replace function public.airnexus_send_friend_request_by_id(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_target_user_id is null then
    raise exception 'A target user is required';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'You cannot add yourself';
  end if;
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'No AirNexus account found';
  end if;
  if exists (
    select 1 from public.friendships f
    where (f.requester_id = auth.uid() and f.addressee_id = p_target_user_id)
       or (f.requester_id = p_target_user_id and f.addressee_id = auth.uid())
  ) then
    raise exception 'A connection with this student already exists';
  end if;
  insert into public.friendships (requester_id, addressee_id, status)
  values (auth.uid(), p_target_user_id, 'pending');
end;
$$;
