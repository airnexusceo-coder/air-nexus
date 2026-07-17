-- AirNexus — admin gifting powers.
-- Adds a server-backed way for admins to gift paid access and Nexus Points
-- without touching Stripe-owned subscription fields or relying on fake UI state.

alter table public.profiles add column if not exists admin_granted_plan text;
alter table public.profiles add column if not exists admin_plan_expires_at timestamptz;
alter table public.profiles add column if not exists admin_plan_granted_at timestamptz;
alter table public.profiles add column if not exists admin_plan_granted_by uuid references public.admin_users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_admin_granted_plan_valid') then
    alter table public.profiles add constraint profiles_admin_granted_plan_valid check (admin_granted_plan is null or admin_granted_plan in ('Plus', 'Premium'));
  end if;
end $$;

create index if not exists profiles_admin_plan_expires_idx on public.profiles(admin_plan_expires_at) where admin_granted_plan is not null;

create table if not exists public.nexus_point_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  description text not null default 'Admin Nexus Points gift',
  granted_by uuid references public.admin_users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint nexus_point_grants_amount_positive check (amount > 0 and amount <= 1000000),
  constraint nexus_point_grants_description_length check (char_length(description) between 1 and 160)
);

create index if not exists nexus_point_grants_user_pending_idx on public.nexus_point_grants(user_id, created_at desc) where claimed_at is null;
create index if not exists nexus_point_grants_granted_by_idx on public.nexus_point_grants(granted_by);

alter table public.nexus_point_grants enable row level security;

-- Service role/admin API writes and claims these rows. Client-side direct writes
-- stay blocked by RLS; users receive gifts only through /api/profile/nexus-grants/claim.
drop policy if exists "read own nexus point grants" on public.nexus_point_grants;
create policy "read own nexus point grants" on public.nexus_point_grants for select using (auth.uid() = user_id);