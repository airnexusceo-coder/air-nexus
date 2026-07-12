-- AirNexus — Stripe billing. Real subscriptions for the Plus/Premium plans
-- that lib/plans.ts already advertises ($1.99/mo, $5/mo) — previously
-- "purchase with card" just flipped local React state with no real charge.
--
-- plan/plan_expires_at/subscription_status become the server-authoritative
-- source of truth for what a user is actually paying for; the client's own
-- localStorage plan field is still used for the free in-app Nexus Points
-- economy (spending points is not real money) but billing status now comes
-- from here, synced exclusively by the Stripe webhook via service-role.
--
-- profiles has a "read friend profiles" RLS policy (0002) with no column
-- restriction, so in principle a friend's raw REST read could return these
-- columns too. In practice no code path in this app performs one: every
-- profiles read/write in lib/ is either scoped to the caller's own row
-- (auth.user.id) or goes through service-role (already RLS-bypassing,
-- already trusted). The only paths to another user's profile data are the
-- SECURITY DEFINER functions in 0007, which project a fixed, curated column
-- list and never touch these new ones. A column-level REVOKE was considered
-- here but rejected: Postgres treats `RETURNING` (what PostgREST emits for
-- `Prefer: return=representation`, used by setDisplayName) as requiring
-- SELECT on every returned column, so revoking would break that existing,
-- unrelated write path. Keep billing values out of any future curated
-- DTO for another user's profile instead of relying on a table-wide revoke.

alter table public.profiles add column if not exists stripe_customer_id text unique;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists stripe_price_id text;
alter table public.profiles add column if not exists plan text not null default 'Free';
alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles add column if not exists subscription_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_plan_valid'
  ) then
    alter table public.profiles add constraint profiles_plan_valid check (plan in ('Free', 'Plus', 'Premium'));
  end if;
end $$;

create index if not exists profiles_stripe_customer_idx on public.profiles(stripe_customer_id);
