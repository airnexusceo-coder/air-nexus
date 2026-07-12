-- Apex — the Nexus Vault economy/strategy feature inside AirGPT.
-- Server-authoritative: Core Energy, Vault Integrity, and hidden defence
-- configuration are never writable by the client. All mutation happens
-- through the service-role backend (lib/apex/vault/*.ts) or the SECURITY
-- DEFINER functions below. Reuses public.set_updated_at() from 0001/0002 and
-- public.profiles / public.friendships / public.apex_profiles from 0002 —
-- nothing here duplicates that foundation.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The persistent Nexus Vault. One per account. Generates and spends Core
-- Energy continuously, including while the owner is offline — see
-- apex_resolve_vault_economy() below, which is the ONLY place elapsed-time
-- math happens.
create table if not exists public.apex_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  core_energy integer not null default 0,
  vault_integrity integer not null default 100,
  generator_level integer not null default 1,
  energy_storage_capacity integer not null default 5000,
  auto_repair_enabled boolean not null default false,
  auto_repair_reserve integer not null default 0,
  breaches_enabled boolean not null default true,
  last_economy_resolved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apex_vaults_core_energy_nonneg check (core_energy >= 0),
  constraint apex_vaults_integrity_range check (vault_integrity between 0 and 100),
  constraint apex_vaults_generator_level_positive check (generator_level >= 1),
  constraint apex_vaults_storage_positive check (energy_storage_capacity > 0),
  constraint apex_vaults_auto_repair_reserve_nonneg check (auto_repair_reserve >= 0)
);

-- The technology catalog (public, read-only to clients). Ownership is
-- separate (apex_user_technologies) — owning tech is NOT the same as it
-- running for free; installed defence tech still costs Core Energy upkeep.
create table if not exists public.apex_technologies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  technology_type text not null,
  description text not null,
  np_acquisition_cost integer not null default 0,
  capacity_cost integer not null default 0,
  startup_energy_cost integer not null default 0,
  upkeep_energy_per_hour integer not null default 0,
  activation_energy_cost integer not null default 0,
  is_active boolean not null default true,
  constraint apex_technologies_type_check check (technology_type in ('defence', 'breach')),
  constraint apex_technologies_np_cost_nonneg check (np_acquisition_cost >= 0),
  constraint apex_technologies_capacity_nonneg check (capacity_cost >= 0),
  constraint apex_technologies_startup_nonneg check (startup_energy_cost >= 0),
  constraint apex_technologies_upkeep_nonneg check (upkeep_energy_per_hour >= 0),
  constraint apex_technologies_activation_nonneg check (activation_energy_cost >= 0)
);

create table if not exists public.apex_user_technologies (
  user_id uuid not null references auth.users(id) on delete cascade,
  technology_id uuid not null references public.apex_technologies(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, technology_id)
);

-- The player's hidden defence chain: which owned defence tech is installed,
-- in what order, at what energy priority, and whether it's currently
-- enabled. THIS IS PRIVATE GAMEPLAY INFORMATION — see the RLS section below.
-- No policy ever grants another user (friend or not) read access to this
-- table.
create table if not exists public.apex_vault_defences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  technology_id uuid not null references public.apex_technologies(id) on delete cascade,
  defence_order integer not null default 0,
  energy_priority integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apex_vault_defences_unique_tech unique (user_id, technology_id)
);
create index if not exists apex_vault_defences_user_idx on public.apex_vault_defences(user_id);

-- A single asynchronous breach attempt. The interactive layer-by-layer
-- resolver lives in migration 0004 (apex_breach_take_action / apex_finalize_breach),
-- which extends this table with result/expiry/finalized columns.
create table if not exists public.apex_breach_sessions (
  id uuid primary key default gen_random_uuid(),
  attacker_user_id uuid not null references auth.users(id) on delete cascade,
  defender_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'preparing',
  breach_budget_initial integer not null default 0,
  breach_energy_remaining integer not null default 0,
  current_layer_index integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint apex_breach_sessions_status_check check (status in ('preparing', 'active', 'completed', 'abandoned')),
  constraint apex_breach_sessions_no_self check (attacker_user_id <> defender_user_id),
  constraint apex_breach_sessions_budget_nonneg check (breach_budget_initial >= 0),
  constraint apex_breach_sessions_remaining_nonneg check (breach_energy_remaining >= 0)
);
create index if not exists apex_breach_sessions_attacker_idx on public.apex_breach_sessions(attacker_user_id, started_at desc);
create index if not exists apex_breach_sessions_defender_idx on public.apex_breach_sessions(defender_user_id, started_at desc);

create table if not exists public.apex_breach_loadout (
  breach_id uuid not null references public.apex_breach_sessions(id) on delete cascade,
  technology_id uuid not null references public.apex_technologies(id) on delete cascade,
  slot_index integer not null,
  usage_state text not null default 'unused',
  constraint apex_breach_loadout_pk primary key (breach_id, slot_index),
  constraint apex_breach_loadout_usage_check check (usage_state in ('unused', 'used'))
);

-- Append-only breach event log. Powers both the attacker's and defender's
-- report views — but those views must show DIFFERENT redacted information
-- (see RLS note below). Not read directly by any client yet.
create table if not exists public.apex_breach_events (
  id uuid primary key default gen_random_uuid(),
  breach_id uuid not null references public.apex_breach_sessions(id) on delete cascade,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists apex_breach_events_breach_idx on public.apex_breach_events(breach_id, created_at);

-- Core Energy ledger. Every balance change is auditable.
create table if not exists public.apex_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null default 'core_energy',
  amount integer not null,
  transaction_type text not null,
  source text,
  reference_id text,
  created_at timestamptz not null default now(),
  constraint apex_transactions_resource_check check (resource_type in ('core_energy')),
  constraint apex_transactions_type_check check (transaction_type in (
    'generation', 'upkeep', 'system_startup', 'breach_commit', 'breach_reward',
    'vault_repair', 'auto_repair', 'breach_destabilisation'
  ))
);
create index if not exists apex_transactions_user_created_idx on public.apex_transactions(user_id, created_at desc);

-- updated_at triggers (reuses public.set_updated_at() from 0001/0002)
drop trigger if exists set_apex_vaults_updated_at on public.apex_vaults;
create trigger set_apex_vaults_updated_at before update on public.apex_vaults
for each row execute function public.set_updated_at();

drop trigger if exists set_apex_vault_defences_updated_at on public.apex_vault_defences;
create trigger set_apex_vault_defences_updated_at before update on public.apex_vault_defences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.apex_vaults enable row level security;
alter table public.apex_technologies enable row level security;
alter table public.apex_user_technologies enable row level security;
alter table public.apex_vault_defences enable row level security;
alter table public.apex_breach_sessions enable row level security;
alter table public.apex_breach_loadout enable row level security;
alter table public.apex_breach_events enable row level security;
alter table public.apex_transactions enable row level security;

-- apex_vaults: read own only. NO insert/update/delete policy for
-- authenticated — Core Energy and Vault Integrity are only ever mutated by
-- apex_resolve_vault_economy() / apex_repair_vault() (SECURITY DEFINER) or
-- the service-role backend.
drop policy if exists "read own vault" on public.apex_vaults;
create policy "read own vault" on public.apex_vaults for select using (auth.uid() = user_id);

-- apex_technologies: public catalog, readable by any authenticated user.
drop policy if exists "read technology catalog" on public.apex_technologies;
create policy "read technology catalog" on public.apex_technologies for select to authenticated using (true);

-- apex_user_technologies: read own only. Writes via the service-role backend
-- (acquireTechnology) after validating ownership doesn't already exist.
drop policy if exists "read own technologies" on public.apex_user_technologies;
create policy "read own technologies" on public.apex_user_technologies for select using (auth.uid() = user_id);

-- apex_vault_defences: read OWN ONLY. This is the hidden defence chain the
-- spec repeatedly stresses must never leak to an attacker — there is
-- deliberately no "friend can read" policy here, unlike public.profiles.
drop policy if exists "read own vault defences" on public.apex_vault_defences;
create policy "read own vault defences" on public.apex_vault_defences for select using (auth.uid() = user_id);

-- apex_breach_sessions: both participants can see a session exists and its
-- status/timestamps (needed for the defender's "your Vault was targeted"
-- alert). The genuinely sensitive numbers (exact defence order/priority)
-- never live in this table.
drop policy if exists "read own breach sessions" on public.apex_breach_sessions;
create policy "read own breach sessions" on public.apex_breach_sessions for select
using (auth.uid() = attacker_user_id or auth.uid() = defender_user_id);

-- apex_breach_loadout: attacker-only, and only for their own sessions. A
-- defender must never see the attacker's equipped tools directly.
drop policy if exists "read own breach loadout" on public.apex_breach_loadout;
create policy "read own breach loadout" on public.apex_breach_loadout for select
using (
  exists (
    select 1 from public.apex_breach_sessions s
    where s.id = breach_id and s.attacker_user_id = auth.uid()
  )
);

-- apex_breach_events: NO client select policy. Deliberately locked down —
-- the attacker/defender report views must show different REDACTED
-- information (not just different rows), which requires a server-computed
-- view. That view doesn't exist yet (breach reports are documented as
-- not-yet-implemented). Default to no access rather than an under-designed
-- policy that could leak the raw event payload.

-- apex_transactions: read own only.
drop policy if exists "read own apex transactions" on public.apex_transactions;
create policy "read own apex transactions" on public.apex_transactions for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Account bootstrap: seed a Vault on signup (in addition to 0002's
-- profile/apex_profiles seeding — a separate trigger, so 0002 stays untouched).
-- ---------------------------------------------------------------------------

create or replace function public.ensure_apex_vault_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.apex_vaults (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_apex_vault_defaults on auth.users;
create trigger create_apex_vault_defaults
after insert on auth.users
for each row execute function public.ensure_apex_vault_defaults();

-- Backfill existing accounts.
insert into public.apex_vaults (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Technology catalog seed. Starting balance EXAMPLES, not final — see
-- lib/apex/vault/config.ts. Idempotent (slug is unique).
-- ---------------------------------------------------------------------------

insert into public.apex_technologies (slug, name, technology_type, description, np_acquisition_cost, capacity_cost, startup_energy_cost, upkeep_energy_per_hour, activation_energy_cost)
values
  ('mirage', 'Mirage', 'defence', 'Creates misleading Vault information — scans may return distorted readings. Primary counter: True Signal.', 80, 1, 120, 8, 0),
  ('firewall', 'Firewall', 'defence', 'A strong signal barrier around the Vault. Primary counter: Phase Signal.', 100, 2, 200, 15, 0),
  ('core-lock', 'Core Lock', 'defence', 'A locked defence checkpoint — low ongoing upkeep, costly to (re)activate. Primary counter: Breach Key.', 140, 2, 260, 6, 0),
  ('core-shield', 'Core Shield', 'defence', 'Absorbs breach pressure using Core Energy. High energy consumption. Primary counter: Overclock.', 150, 2, 180, 30, 0),
  ('ghost-layer', 'Ghost Layer', 'defence', 'Hides information about the next defence layer. Primary counter: Deep Scan.', 130, 2, 190, 12, 0),
  ('counter-trace', 'Counter Trace', 'defence', 'When the Vault successfully defends, retains limited information about the attack signature.', 110, 1, 100, 5, 0),
  ('signal-redirect', 'Signal Redirect', 'defence', 'Changes the behaviour or direction of one breach interaction.', 160, 2, 220, 18, 0),
  ('fortress-core', 'Fortress Core', 'defence', 'A high-cost final defence layer. Large capacity, high upkeep — difficult to maintain continuously.', 260, 3, 400, 45, 0),
  ('signal-probe', 'Signal Probe', 'breach', 'Analyse limited information about the next defence system. May be affected by Mirage.', 60, 0, 0, 0, 40),
  ('breach-key', 'Breach Key', 'breach', 'Primary counter to Core Lock.', 120, 0, 0, 0, 90),
  ('phase-signal', 'Phase Signal', 'breach', 'Primary counter to Firewall.', 125, 0, 0, 0, 150),
  ('true-signal', 'True Signal', 'breach', 'Detect or neutralise eligible Mirage effects.', 100, 0, 0, 0, 70),
  ('overclock', 'Overclock', 'breach', 'Apply high Core Energy pressure to a powerful defence such as Core Shield.', 140, 0, 0, 0, 180),
  ('deep-scan', 'Deep Scan', 'breach', 'Reveal limited information hidden by Ghost Layer.', 130, 0, 0, 0, 110),
  ('emergency-extract', 'Emergency Extract', 'breach', 'End a breach early. May preserve one eligible unused tool depending on balance rules.', 90, 0, 0, 0, 50),
  ('signal-fork', 'Signal Fork', 'breach', 'Provide an additional response option during one eligible defence interaction.', 150, 0, 0, 0, 130)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- apex_resolve_vault_economy — the ONLY place elapsed-time economy math
-- happens. Row-locked (for update) to prevent concurrent double-generation.
-- Timestamp-based so it's correct regardless of how long the account was
-- offline; the client can never claim "I was offline for N hours". Applies
-- generator output, then charges upkeep for enabled defences in energy
-- priority order, auto-disabling the lowest-priority system(s) that can't be
-- afforded (spec: "lower-priority systems shut down first").
-- ---------------------------------------------------------------------------

create or replace function public.apex_resolve_vault_economy(p_user_id uuid)
returns public.apex_vaults
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vault public.apex_vaults;
  v_elapsed_hours numeric;
  v_output_per_hour integer;
  v_generated integer;
  v_upkeep integer;
  v_defence record;
begin
  select * into v_vault from public.apex_vaults where user_id = p_user_id for update;
  if not found then
    insert into public.apex_vaults (user_id) values (p_user_id) returning * into v_vault;
    return v_vault;
  end if;

  v_elapsed_hours := greatest(0, extract(epoch from (now() - v_vault.last_economy_resolved_at)) / 3600.0);
  if v_elapsed_hours <= 0 then
    return v_vault;
  end if;

  -- Generator output. Kept in sync with GENERATOR_OUTPUT_PER_LEVEL_PER_HOUR
  -- in lib/apex/vault/config.ts (SQL can't import the TS constant).
  v_output_per_hour := v_vault.generator_level * 100;
  v_generated := round(v_output_per_hour * v_elapsed_hours);
  v_vault.core_energy := least(v_vault.core_energy + v_generated, v_vault.energy_storage_capacity);

  for v_defence in
    select d.id, t.upkeep_energy_per_hour
    from public.apex_vault_defences d
    join public.apex_technologies t on t.id = d.technology_id
    where d.user_id = p_user_id and d.is_enabled = true
    order by d.energy_priority asc, d.id asc
  loop
    v_upkeep := round(v_defence.upkeep_energy_per_hour * v_elapsed_hours);
    if v_vault.core_energy >= v_upkeep then
      v_vault.core_energy := v_vault.core_energy - v_upkeep;
    else
      update public.apex_vault_defences set is_enabled = false, updated_at = now() where id = v_defence.id;
    end if;
  end loop;

  v_vault.core_energy := greatest(v_vault.core_energy, 0);
  v_vault.last_economy_resolved_at := now();

  update public.apex_vaults
  set core_energy = v_vault.core_energy,
      last_economy_resolved_at = v_vault.last_economy_resolved_at,
      updated_at = now()
  where user_id = p_user_id;

  if v_generated <> 0 then
    insert into public.apex_transactions (user_id, amount, transaction_type, source)
    values (p_user_id, v_generated, 'generation', 'apex_resolve_vault_economy');
  end if;

  return v_vault;
end;
$$;

revoke all on function public.apex_resolve_vault_economy(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- apex_repair_vault — atomic CE-for-Integrity repair. Validates affordability
-- inside the same transaction as the deduction (no read-then-write race).
-- ---------------------------------------------------------------------------

create or replace function public.apex_repair_vault(p_user_id uuid, p_integrity_restore integer, p_cost integer)
returns public.apex_vaults
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vault public.apex_vaults;
begin
  select * into v_vault from public.apex_vaults where user_id = p_user_id for update;
  if not found then
    raise exception 'Vault not found';
  end if;
  if v_vault.core_energy < p_cost then
    raise exception 'Insufficient Core Energy';
  end if;

  update public.apex_vaults
  set core_energy = core_energy - p_cost,
      vault_integrity = least(100, vault_integrity + greatest(0, p_integrity_restore)),
      updated_at = now()
  where user_id = p_user_id
  returning * into v_vault;

  insert into public.apex_transactions (user_id, amount, transaction_type, source)
  values (p_user_id, -p_cost, 'vault_repair', 'manual_repair');

  return v_vault;
end;
$$;

revoke all on function public.apex_repair_vault(uuid, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- apex_adjust_core_energy — general atomic Core Energy spend/credit primitive
-- used by every other protected mutation (technology startup costs, defence
-- (re)activation, breach budget commitment). Row-locks the vault so
-- affordability is checked and applied in one transaction — no
-- check-then-write race between concurrent requests. Clamps to storage
-- capacity on credit; raises on an unaffordable debit rather than allowing
-- energy to go negative.
-- ---------------------------------------------------------------------------

create or replace function public.apex_adjust_core_energy(
  p_user_id uuid,
  p_delta integer,
  p_transaction_type text,
  p_source text default null
)
returns public.apex_vaults
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vault public.apex_vaults;
begin
  select * into v_vault from public.apex_vaults where user_id = p_user_id for update;
  if not found then
    raise exception 'Vault not found';
  end if;
  if p_delta < 0 and v_vault.core_energy + p_delta < 0 then
    raise exception 'Insufficient Core Energy';
  end if;

  update public.apex_vaults
  set core_energy = least(energy_storage_capacity, greatest(0, core_energy + p_delta)),
      updated_at = now()
  where user_id = p_user_id
  returning * into v_vault;

  insert into public.apex_transactions (user_id, amount, transaction_type, source)
  values (p_user_id, p_delta, p_transaction_type, p_source);

  return v_vault;
end;
$$;

revoke all on function public.apex_adjust_core_energy(uuid, integer, text, text) from public, anon, authenticated;
