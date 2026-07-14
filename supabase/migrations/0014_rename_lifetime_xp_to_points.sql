-- AirNexus — consolidates the app's "XP" vocabulary into its single Nexus
-- Points currency. profiles.lifetime_xp (added in 0007) mirrored
-- lib/motivation.ts's local point total under a name that implied it was a
-- separate currency from Nexus Points; it never was. Renaming it (and the
-- dependent airnexus_public_profile RPC) to lifetime_points. Apex Clash's
-- own apex_xp column/RPC output is untouched — that is a genuinely separate,
-- server-authoritative system.

alter table public.profiles rename column lifetime_xp to lifetime_points;

drop function if exists public.airnexus_public_profile(uuid);

create function public.airnexus_public_profile(p_target_user_id uuid)
returns table (
  user_id uuid,
  display_name text,
  apex_xp bigint,
  lifetime_points integer,
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
    p.lifetime_points,
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
