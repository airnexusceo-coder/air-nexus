-- AirNexus shared social + economy foundation.
-- Powers systems shared across AirGPT and Apex: user profiles, the friend
-- graph, the Air Points wallet/ledger, and Apex progression (apex_profiles).
-- Server-authoritative: currency/XP mutation happens through the service-role
-- backend or SECURITY DEFINER functions. Clients can never write wallets or
-- apex_profiles.apex_xp directly.

create extension if not exists pgcrypto;

-- Reuse the shared updated_at trigger fn from 0001 if present; define defensively.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- DEPRECATED: Air Points ("AP") was an earlier Apex resource concept, since
-- replaced by Core Energy (see 0003_apex_nexus_vault.sql). air_wallets /
-- air_transactions / this function are kept only because this migration may
-- already be applied in some environment and dropping tables is riskier than
-- leaving them inert — no active application code reads or writes them.
create or replace function public.airnexus_starter_air()
returns integer
language sql
immutable
as $$ select 0 $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'AirNexus student',
  allow_nexus_challenges boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 80)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_status_check check (status in ('pending', 'accepted', 'blocked')),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);
create index if not exists friendships_requester_idx on public.friendships(requester_id);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id);

-- DEPRECATED — see note above. Not used by any active Apex code.
create table if not exists public.air_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint air_wallets_balance_nonneg check (balance >= 0)
);

-- DEPRECATED — see note above. Not used by any active Apex code.
create table if not exists public.air_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  transaction_type text not null,
  reference_id text,
  created_at timestamptz not null default now(),
  constraint air_transactions_type_check check (transaction_type in ('starter_grant', 'conversion', 'match_spend', 'admin_grant'))
);
create index if not exists air_transactions_user_created_idx on public.air_transactions(user_id, created_at desc);

-- Apex progression (separate from Nexus Points). apex_rank is derived from
-- apex_xp in app config; the stored column is a convenience cache.
create table if not exists public.apex_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  apex_xp bigint not null default 0,
  apex_rank text not null default 'unranked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apex_profiles_xp_nonneg check (apex_xp >= 0)
);

-- updated_at triggers
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_friendships_updated_at on public.friendships;
create trigger set_friendships_updated_at before update on public.friendships
for each row execute function public.set_updated_at();

drop trigger if exists set_air_wallets_updated_at on public.air_wallets;
create trigger set_air_wallets_updated_at before update on public.air_wallets
for each row execute function public.set_updated_at();

drop trigger if exists set_apex_profiles_updated_at on public.apex_profiles;
create trigger set_apex_profiles_updated_at before update on public.apex_profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.air_wallets enable row level security;
alter table public.air_transactions enable row level security;
alter table public.apex_profiles enable row level security;

-- profiles: read own; read profiles of accepted friends; update own.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = user_id);

drop policy if exists "read friend profiles" on public.profiles;
create policy "read friend profiles" on public.profiles for select using (
  exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = profiles.user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = profiles.user_id))
  )
);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = user_id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- friendships: either party reads; requester creates pending; either party updates their edges.
drop policy if exists "read own friendships" on public.friendships;
create policy "read own friendships" on public.friendships for select
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "create friend request" on public.friendships;
create policy "create friend request" on public.friendships for insert
with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "update own friendship edge" on public.friendships;
create policy "update own friendship edge" on public.friendships for update
using (auth.uid() = requester_id or auth.uid() = addressee_id)
with check (auth.uid() = requester_id or auth.uid() = addressee_id);

-- air_wallets / air_transactions / apex_profiles: SELECT own only; NO client write (service role only).
drop policy if exists "read own air wallet" on public.air_wallets;
create policy "read own air wallet" on public.air_wallets for select using (auth.uid() = user_id);

drop policy if exists "read own air transactions" on public.air_transactions;
create policy "read own air transactions" on public.air_transactions for select using (auth.uid() = user_id);

drop policy if exists "read own apex profile" on public.apex_profiles;
create policy "read own apex profile" on public.apex_profiles for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Account bootstrap: seed profile + wallet + apex profile on signup.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_airnexus_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  starter integer := public.airnexus_starter_air();
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'AirNexus student'))
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

drop trigger if exists create_airnexus_defaults on auth.users;
create trigger create_airnexus_defaults
after insert on auth.users
for each row execute function public.ensure_airnexus_defaults();

-- Backfill existing accounts.
insert into public.profiles (user_id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'AirNexus student')
from auth.users u
on conflict (user_id) do nothing;

insert into public.air_wallets (user_id, balance)
select u.id, public.airnexus_starter_air() from auth.users u
on conflict (user_id) do nothing;

insert into public.apex_profiles (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Friend-graph RPCs (SECURITY DEFINER so they can resolve emails / read a
-- counterpart's display name that RLS otherwise hides).
-- ---------------------------------------------------------------------------

create or replace function public.airnexus_accepted_friends()
returns table (
  user_id uuid,
  display_name text,
  apex_xp bigint,
  allow_nexus_challenges boolean
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
    p.allow_nexus_challenges
  from public.friendships f
  join public.profiles p
    on p.user_id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  left join public.apex_profiles ap on ap.user_id = p.user_id
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid());
$$;

create or replace function public.airnexus_send_friend_request(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  select id into v_target from auth.users where lower(email) = lower(trim(target_email)) limit 1;
  if v_target is null then
    raise exception 'No AirNexus account uses that email';
  end if;
  if v_target = auth.uid() then
    raise exception 'You cannot add yourself';
  end if;
  if exists (
    select 1 from public.friendships f
    where (f.requester_id = auth.uid() and f.addressee_id = v_target)
       or (f.requester_id = v_target and f.addressee_id = auth.uid())
  ) then
    raise exception 'A connection with this student already exists';
  end if;
  insert into public.friendships (requester_id, addressee_id, status)
  values (auth.uid(), v_target, 'pending');
end;
$$;

create or replace function public.airnexus_list_friend_requests()
returns table (
  id uuid,
  direction text,
  other_user_id uuid,
  display_name text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id,
    case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end as direction,
    case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as other_user_id,
    p.display_name,
    f.status,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.user_id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    and f.status = 'pending';
$$;
