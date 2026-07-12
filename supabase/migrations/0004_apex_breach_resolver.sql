-- Apex — the interactive breach resolver, achievements, and the schema
-- needed for both. Extends 0003_apex_nexus_vault.sql; does not modify any
-- already-applied table in a breaking way (only additive ALTERs).
--
-- BREACH MODEL (documented here; see APEX_HANDOFF.md for the full writeup):
-- A breach is a turn-based, server-resolved strategy session — never
-- realtime, never client-authoritative. At creation, the DEFENDER'S CURRENT
-- ACTIVE DEFENCES ARE SNAPSHOT into apex_breach_layers (a "defence snapshot"
-- decision, not live state) — this makes a breach fair and reproducible even
-- if the defender changes their Vault mid-breach, and means the attacker
-- never queries the defender's live private state. Exactly 3 layers are
-- always created (Outer Perimeter / Inner Sanctum / Core Gate), built from
-- the defender's first two active installed defences (by defence_order) plus
-- a baseline "Core Gate" whose strength folds in any further active
-- defences — so defence order, count, and active/inactive state all
-- genuinely change the breach, while keeping a fixed, UI-friendly 3-layer
-- shape regardless of vault size.
--
-- Five conceptual stages map onto this 3-layer model without needing a
-- separate stage-tracking column: SCAN (an optional free-ish intel action on
-- the current layer before it's revealed) -> OUTER (layer 0) -> DEEP (layer
-- 1) -> CORE (layer 2) -> RESULT (session finalised). `current_layer_index`
-- (already on apex_breach_sessions) is the single source of truth for where
-- the attacker is.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Schema: technology matchups (data-driven, reuses the existing 16-item
-- catalogue — no new technologies).
-- ---------------------------------------------------------------------------

alter table public.apex_technologies
  add column if not exists counters_technology_id uuid references public.apex_technologies(id);

update public.apex_technologies b
set counters_technology_id = d.id
from public.apex_technologies d
where b.technology_type = 'breach'
  and d.technology_type = 'defence'
  and (
    (b.slug = 'true-signal' and d.slug = 'mirage') or
    (b.slug = 'phase-signal' and d.slug = 'firewall') or
    (b.slug = 'breach-key' and d.slug = 'core-lock') or
    (b.slug = 'overclock' and d.slug = 'core-shield') or
    (b.slug = 'deep-scan' and d.slug = 'ghost-layer')
  );
-- signal-probe (general reveal), emergency-extract (retreat aid), and
-- signal-fork (extra response) deliberately have no specific counter target —
-- they're generalist tools, not specialised counters.

-- ---------------------------------------------------------------------------
-- Schema: breach loadout gets real scarcity (one use per equipped tool).
-- ---------------------------------------------------------------------------

alter table public.apex_breach_loadout
  add column if not exists charges_remaining integer not null default 1;
alter table public.apex_breach_loadout
  drop constraint if exists apex_breach_loadout_charges_nonneg;
alter table public.apex_breach_loadout
  add constraint apex_breach_loadout_charges_nonneg check (charges_remaining >= 0);

-- ---------------------------------------------------------------------------
-- Schema: breach session lifecycle (adds 'expired' status + resolution
-- bookkeeping columns needed by the resolver).
-- ---------------------------------------------------------------------------

alter table public.apex_breach_sessions drop constraint if exists apex_breach_sessions_status_check;
alter table public.apex_breach_sessions
  add constraint apex_breach_sessions_status_check check (status in ('preparing', 'active', 'completed', 'expired', 'abandoned'));

alter table public.apex_breach_sessions add column if not exists result text;
alter table public.apex_breach_sessions drop constraint if exists apex_breach_sessions_result_check;
alter table public.apex_breach_sessions
  add constraint apex_breach_sessions_result_check check (result is null or result in ('breached', 'contained', 'retreated'));

alter table public.apex_breach_sessions add column if not exists xp_awarded integer not null default 0;
alter table public.apex_breach_sessions add column if not exists reward_energy integer not null default 0;
alter table public.apex_breach_sessions add column if not exists expires_at timestamptz;
alter table public.apex_breach_sessions add column if not exists finalized boolean not null default false;

-- ---------------------------------------------------------------------------
-- The defence snapshot for a breach session. NEVER exposed to the client as
-- a raw row — `technology_id`/`slug`/`name` must stay hidden until
-- `is_revealed = true`, and RLS (row-level) can't express that per-column
-- redaction, so this table has NO client select policy at all (see RLS
-- below). The API layer (service role) builds a purpose-built sanitised DTO.
-- ---------------------------------------------------------------------------

create table if not exists public.apex_breach_layers (
  id uuid primary key default gen_random_uuid(),
  breach_id uuid not null references public.apex_breach_sessions(id) on delete cascade,
  layer_index integer not null,
  technology_id uuid references public.apex_technologies(id),
  slug text not null,
  name text not null,
  strength integer not null,
  integrity integer not null,
  is_broken boolean not null default false,
  is_revealed boolean not null default false,
  actions_taken integer not null default 0,
  created_at timestamptz not null default now(),
  constraint apex_breach_layers_unique unique (breach_id, layer_index),
  constraint apex_breach_layers_layer_index_range check (layer_index between 0 and 2),
  constraint apex_breach_layers_strength_positive check (strength > 0),
  constraint apex_breach_layers_integrity_nonneg check (integrity >= 0)
);
create index if not exists apex_breach_layers_breach_idx on public.apex_breach_layers(breach_id, layer_index);

alter table public.apex_breach_layers enable row level security;
-- Deliberately no select policy — see comment above the table.

-- ---------------------------------------------------------------------------
-- Achievements — server-awarded only, from real finalised-breach events.
-- ---------------------------------------------------------------------------

create table if not exists public.apex_achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.apex_user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.apex_achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
create index if not exists apex_user_achievements_user_idx on public.apex_user_achievements(user_id, earned_at desc);

alter table public.apex_achievements enable row level security;
alter table public.apex_user_achievements enable row level security;

drop policy if exists "read achievement catalog" on public.apex_achievements;
create policy "read achievement catalog" on public.apex_achievements for select to authenticated using (true);

drop policy if exists "read own achievements" on public.apex_user_achievements;
create policy "read own achievements" on public.apex_user_achievements for select using (auth.uid() = user_id);

insert into public.apex_achievements (slug, name, description) values
  ('first-breach', 'First Breach', 'Successfully breach a Vault for the first time.'),
  ('corebreaker', 'Corebreaker', 'Successfully breach 5 Vaults.'),
  ('deep-breach', 'Deep Breach', 'Reach the Core Gate during a breach.'),
  ('against-the-odds', 'Against the Odds', 'Breach a higher-ranked defender''s Vault.'),
  ('systems-architect', 'Systems Architect', 'Own 12 or more Apex technologies.'),
  ('full-power', 'Full Power', 'Use all of your Defence Capacity at once.'),
  ('perfect-defence', 'Perfect Defence', 'Contain a breach without losing a single defence layer.'),
  ('untouchable', 'Untouchable', 'Successfully defend against a higher-ranked attacker.'),
  ('five-containments', 'Five Containments', 'Successfully defend your Vault 5 times.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- apex_award_achievement — idempotent grant helper used by the finalizer.
-- ---------------------------------------------------------------------------

create or replace function public.apex_award_achievement(p_user_id uuid, p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.apex_user_achievements (user_id, achievement_id)
  select p_user_id, a.id from public.apex_achievements a where a.slug = p_slug
  on conflict (user_id, achievement_id) do nothing;
end;
$$;

revoke all on function public.apex_award_achievement(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- apex_create_breach_layers — builds the 3-layer defence snapshot from the
-- defender's CURRENT active installed defences at breach start. Called once,
-- immediately after a breach session is created.
-- ---------------------------------------------------------------------------

create or replace function public.apex_create_breach_layers(p_breach_id uuid, p_defender_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outer_tech uuid;
  v_outer_slug text;
  v_outer_name text;
  v_outer_strength integer;
  v_deep_tech uuid;
  v_deep_slug text;
  v_deep_name text;
  v_deep_strength integer;
  v_core_strength integer := 80;
  v_core_name text := 'Vault Core';
  v_extra record;
  v_extra_count integer := 0;
begin
  select d.technology_id, t.slug, t.name, t.startup_energy_cost
    into v_outer_tech, v_outer_slug, v_outer_name, v_outer_strength
    from public.apex_vault_defences d
    join public.apex_technologies t on t.id = d.technology_id
    where d.user_id = p_defender_id and d.is_enabled = true
    order by d.defence_order asc, d.id asc
    limit 1;

  if v_outer_tech is not null then
    insert into public.apex_breach_layers (breach_id, layer_index, technology_id, slug, name, strength, integrity)
      values (p_breach_id, 0, v_outer_tech, v_outer_slug, v_outer_name, greatest(30, v_outer_strength), greatest(30, v_outer_strength));
  else
    insert into public.apex_breach_layers (breach_id, layer_index, technology_id, slug, name, strength, integrity)
      values (p_breach_id, 0, null, 'outer-baseline', 'Outer Perimeter', 60, 60);
  end if;

  select d.technology_id, t.slug, t.name, t.startup_energy_cost
    into v_deep_tech, v_deep_slug, v_deep_name, v_deep_strength
    from public.apex_vault_defences d
    join public.apex_technologies t on t.id = d.technology_id
    where d.user_id = p_defender_id and d.is_enabled = true
    order by d.defence_order asc, d.id asc
    offset 1 limit 1;

  if v_deep_tech is not null then
    insert into public.apex_breach_layers (breach_id, layer_index, technology_id, slug, name, strength, integrity)
      values (p_breach_id, 1, v_deep_tech, v_deep_slug, v_deep_name, greatest(30, v_deep_strength), greatest(30, v_deep_strength));
  else
    insert into public.apex_breach_layers (breach_id, layer_index, technology_id, slug, name, strength, integrity)
      values (p_breach_id, 1, null, 'deep-baseline', 'Inner Sanctum', 70, 70);
  end if;

  for v_extra in
    select t.startup_energy_cost as cost
    from public.apex_vault_defences d
    join public.apex_technologies t on t.id = d.technology_id
    where d.user_id = p_defender_id and d.is_enabled = true
    order by d.defence_order asc, d.id asc
    offset 2
  loop
    v_core_strength := v_core_strength + round(v_extra.cost * 0.5);
    v_extra_count := v_extra_count + 1;
  end loop;

  if v_extra_count > 0 then
    v_core_name := 'Core Gate';
  end if;

  insert into public.apex_breach_layers (breach_id, layer_index, technology_id, slug, name, strength, integrity)
    values (p_breach_id, 2, null, 'core-gate', v_core_name, v_core_strength, v_core_strength);
end;
$$;

revoke all on function public.apex_create_breach_layers(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- apex_finalize_breach — resolves the session exactly once (idempotent via
-- the `finalized` flag, checked under the row lock already held by the
-- caller). Awards Clash XP (anti-farm multiplier applied), a Core Energy
-- reward funded as an economy sink from the defender (never a direct
-- player-to-player transfer framing — two independent ledger entries),
-- applies Vault Integrity destabilisation on a successful breach, and
-- server-awards achievements from the real outcome.
-- ---------------------------------------------------------------------------

create or replace function public.apex_finalize_breach(p_breach_id uuid, p_result text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.apex_breach_sessions;
  v_attacker_xp bigint;
  v_defender_xp bigint;
  v_xp integer;
  v_reward_energy integer;
  v_layers_broken integer;
  v_max_layer_reached integer;
  v_multiplier numeric;
  v_recent_count integer;
  v_won_count integer;
  v_defended_count integer;
  v_owned_count integer;
  v_capacity_used integer;
  v_defender_energy integer;
  v_actual_destabilisation integer;
begin
  select * into v_session from public.apex_breach_sessions where id = p_breach_id for update;
  if v_session.id is null then
    raise exception 'Breach session not found';
  end if;
  if v_session.finalized then
    return;
  end if;

  select count(*) into v_layers_broken from public.apex_breach_layers where breach_id = p_breach_id and is_broken = true;
  select max(layer_index) into v_max_layer_reached from public.apex_breach_layers where breach_id = p_breach_id and is_revealed = true;

  select coalesce(apex_xp, 0) into v_attacker_xp from public.apex_profiles where user_id = v_session.attacker_user_id;
  select coalesce(apex_xp, 0) into v_defender_xp from public.apex_profiles where user_id = v_session.defender_user_id;

  select count(*) into v_recent_count
    from public.apex_breach_sessions
    where attacker_user_id = v_session.attacker_user_id
      and defender_user_id = v_session.defender_user_id
      and finalized = true
      and completed_at >= now() - interval '24 hours'
      and id <> p_breach_id;

  v_multiplier := case
    when v_recent_count = 0 then 1.0
    when v_recent_count = 1 then 0.5
    when v_recent_count = 2 then 0.2
    else 0.0
  end;

  if p_result = 'breached' then
    v_xp := round((40 + v_layers_broken * 6) * v_multiplier);
    if v_defender_xp > v_attacker_xp then
      v_xp := v_xp + round(8 * v_multiplier);
    end if;
    v_reward_energy := round(v_session.breach_budget_initial * 0.25);
  elsif p_result = 'contained' then
    v_xp := case when coalesce(v_max_layer_reached, -1) >= 1 then round(10 * v_multiplier) else 0 end;
    v_reward_energy := 0;
  else
    v_xp := 0;
    v_reward_energy := 0;
  end if;

  update public.apex_breach_sessions
    set status = 'completed',
        result = p_result,
        xp_awarded = v_xp,
        reward_energy = v_reward_energy,
        completed_at = now(),
        finalized = true
    where id = p_breach_id;

  if v_xp > 0 then
    update public.apex_profiles set apex_xp = apex_xp + v_xp where user_id = v_session.attacker_user_id;
  end if;

  if v_reward_energy > 0 then
    perform public.apex_adjust_core_energy(v_session.attacker_user_id, v_reward_energy, 'breach_reward', p_breach_id::text);
  end if;

  if p_result = 'breached' then
    select core_energy into v_defender_energy from public.apex_vaults where user_id = v_session.defender_user_id;
    v_actual_destabilisation := least(v_reward_energy, coalesce(v_defender_energy, 0));
    if v_actual_destabilisation > 0 then
      perform public.apex_adjust_core_energy(v_session.defender_user_id, -v_actual_destabilisation, 'breach_destabilisation', p_breach_id::text);
    end if;
    update public.apex_vaults
      set vault_integrity = greatest(0, vault_integrity - 15)
      where user_id = v_session.defender_user_id;
  end if;

  insert into public.apex_breach_events (breach_id, event_type, event_payload)
    values (p_breach_id, 'breach_result', jsonb_build_object('result', p_result, 'xp_awarded', v_xp, 'reward_energy', v_reward_energy));

  if p_result = 'breached' then
    perform public.apex_award_achievement(v_session.attacker_user_id, 'first-breach');

    select count(*) into v_won_count from public.apex_breach_sessions
      where attacker_user_id = v_session.attacker_user_id and result = 'breached' and finalized = true;
    if v_won_count >= 5 then
      perform public.apex_award_achievement(v_session.attacker_user_id, 'corebreaker');
    end if;

    if v_defender_xp > v_attacker_xp then
      perform public.apex_award_achievement(v_session.attacker_user_id, 'against-the-odds');
    end if;
  end if;

  if coalesce(v_max_layer_reached, -1) >= 2 then
    perform public.apex_award_achievement(v_session.attacker_user_id, 'deep-breach');
  end if;

  if p_result <> 'breached' then
    if v_layers_broken = 0 then
      perform public.apex_award_achievement(v_session.defender_user_id, 'perfect-defence');
    end if;
    if v_attacker_xp > v_defender_xp then
      perform public.apex_award_achievement(v_session.defender_user_id, 'untouchable');
    end if;
    select count(*) into v_defended_count from public.apex_breach_sessions
      where defender_user_id = v_session.defender_user_id and result <> 'breached' and result is not null and finalized = true;
    if v_defended_count >= 5 then
      perform public.apex_award_achievement(v_session.defender_user_id, 'five-containments');
    end if;
  end if;

  select count(*) into v_owned_count from public.apex_user_technologies where user_id = v_session.attacker_user_id;
  if v_owned_count >= 12 then
    perform public.apex_award_achievement(v_session.attacker_user_id, 'systems-architect');
  end if;

  select coalesce(sum(t.capacity_cost), 0) into v_capacity_used
    from public.apex_vault_defences d
    join public.apex_technologies t on t.id = d.technology_id
    where d.user_id = v_session.attacker_user_id and d.is_enabled = true;
  if v_capacity_used >= 8 then
    perform public.apex_award_achievement(v_session.attacker_user_id, 'full-power');
  end if;
end;
$$;

revoke all on function public.apex_finalize_breach(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- apex_breach_take_action — the core resolver. ONE atomic, row-locked
-- function call per player decision: validates ownership/status/expiry,
-- resolves the chosen action against the current (locked) layer row,
-- applies a bounded auditable random factor (stored in the event payload),
-- deducts breach energy, logs an event, advances/finalises the session as
-- appropriate. The client supplies only an action id and (optionally) a
-- technology slug — every number in the outcome is computed here, never
-- trusted from the caller.
-- ---------------------------------------------------------------------------

create or replace function public.apex_breach_take_action(
  p_breach_id uuid,
  p_attacker_id uuid,
  p_action text,
  p_technology_slug text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.apex_breach_sessions;
  v_layer public.apex_breach_layers;
  v_tool_id uuid;
  v_tool_activation_cost integer;
  v_tool_counters_id uuid;
  v_charges integer;
  v_matched boolean := false;
  v_base_pressure numeric;
  v_random_factor numeric;
  v_pressure integer;
  v_cost integer;
  v_message text;
  v_next_index integer;
  v_next_layer public.apex_breach_layers;
  v_remaining integer;
begin
  select * into v_session from public.apex_breach_sessions where id = p_breach_id for update;
  if v_session.id is null then
    raise exception 'Breach session not found';
  end if;
  if v_session.attacker_user_id <> p_attacker_id then
    raise exception 'Not your breach session';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Breach session is not active';
  end if;

  if v_session.expires_at is not null and now() > v_session.expires_at then
    update public.apex_breach_sessions set status = 'expired' where id = p_breach_id;
    perform public.apex_finalize_breach(p_breach_id, 'contained');
    insert into public.apex_breach_events (breach_id, event_type, event_payload)
      values (p_breach_id, 'expired', jsonb_build_object('message', 'The breach window expired.'));
    return;
  end if;

  if p_action = 'retreat' then
    perform public.apex_finalize_breach(p_breach_id, 'retreated');
    insert into public.apex_breach_events (breach_id, event_type, event_payload)
      values (p_breach_id, 'retreat', jsonb_build_object('layer_index', v_session.current_layer_index, 'message', 'You retreated from the breach.'));
    return;
  end if;

  if p_action not in ('scan', 'probe', 'use_tool', 'overload') then
    raise exception 'Unknown action';
  end if;

  select * into v_layer from public.apex_breach_layers
    where breach_id = p_breach_id and layer_index = v_session.current_layer_index
    for update;
  if v_layer.id is null then
    raise exception 'Breach layer not found';
  end if;
  if v_layer.is_broken then
    raise exception 'This layer is already broken';
  end if;

  -- SCAN: a cheap, pressure-free reveal. Only useful before the layer's
  -- identity is already known.
  if p_action = 'scan' then
    if v_layer.is_revealed then
      raise exception 'This layer has already been scanned';
    end if;
    v_cost := 10;
    if v_session.breach_energy_remaining < v_cost then
      raise exception 'Insufficient breach energy for this action';
    end if;
    update public.apex_breach_sessions set breach_energy_remaining = breach_energy_remaining - v_cost where id = p_breach_id;
    update public.apex_breach_layers set is_revealed = true where id = v_layer.id;
    insert into public.apex_breach_events (breach_id, event_type, event_payload)
      values (p_breach_id, 'scan', jsonb_build_object('layer_index', v_layer.layer_index, 'layer_name', v_layer.name, 'message', 'Scan complete — ' || v_layer.name || ' identified.'));
    return;
  end if;

  -- PROBE (default, cheap, low pressure) / OVERLOAD (costly, high pressure) / USE_TOOL.
  v_cost := 20;
  v_base_pressure := v_layer.strength * 0.22;

  if p_action = 'overload' then
    v_cost := 60;
    v_base_pressure := v_layer.strength * 0.4;
  elsif p_action = 'use_tool' then
    if p_technology_slug is null then
      raise exception 'A technology is required for this action';
    end if;

    select t.id, t.activation_energy_cost, t.counters_technology_id
      into v_tool_id, v_tool_activation_cost, v_tool_counters_id
      from public.apex_technologies t
      where t.slug = p_technology_slug and t.technology_type = 'breach';
    if v_tool_id is null then
      raise exception 'Unknown breach technology';
    end if;

    select bl.charges_remaining into v_charges
      from public.apex_breach_loadout bl
      where bl.breach_id = p_breach_id and bl.technology_id = v_tool_id
      for update;
    if v_charges is null then
      raise exception 'Technology not equipped for this breach';
    end if;
    if v_charges <= 0 then
      raise exception 'No charges remaining for this technology';
    end if;

    v_matched := (v_tool_counters_id is not null and v_tool_counters_id = v_layer.technology_id);
    v_cost := v_tool_activation_cost;
    v_base_pressure := v_layer.strength * (case when v_matched then 0.68 else 0.3 end);

    update public.apex_breach_loadout
      set charges_remaining = charges_remaining - 1, usage_state = 'used'
      where breach_id = p_breach_id and technology_id = v_tool_id;
  end if;

  if v_session.breach_energy_remaining < v_cost then
    raise exception 'Insufficient breach energy for this action';
  end if;

  -- Bounded, auditable randomness (+/-15%) — strategy dominates, some
  -- uncertainty remains. Stored in the event payload for full auditability.
  v_random_factor := 0.85 + random() * 0.3;
  v_pressure := greatest(1, round(v_base_pressure * v_random_factor));

  update public.apex_breach_sessions
    set breach_energy_remaining = breach_energy_remaining - v_cost
    where id = p_breach_id
    returning breach_energy_remaining into v_remaining;

  update public.apex_breach_layers
    set integrity = greatest(0, integrity - v_pressure),
        actions_taken = actions_taken + 1,
        is_revealed = true
    where id = v_layer.id
    returning * into v_layer;

  v_message := case
    when p_action = 'use_tool' and v_matched then v_layer.name || ' destabilised — your technology exploited a direct weakness.'
    when p_action = 'use_tool' and not v_matched then 'Your tool struck ' || v_layer.name || ', but the matchup was unfavourable.'
    when p_action = 'overload' then 'Overload pressure strained ' || v_layer.name || '.'
    else 'Standard probe pressured ' || v_layer.name || '.'
  end;

  insert into public.apex_breach_events (breach_id, event_type, event_payload)
    values (p_breach_id, 'layer_pressure', jsonb_build_object(
      'layer_index', v_layer.layer_index,
      'layer_name', v_layer.name,
      'action', p_action,
      'technology_slug', p_technology_slug,
      'matched_counter', v_matched,
      'pressure', v_pressure,
      'random_factor', round(v_random_factor, 3),
      'integrity_remaining', v_layer.integrity,
      'energy_spent', v_cost,
      'message', v_message
    ));

  if v_layer.integrity <= 0 then
    update public.apex_breach_layers set is_broken = true where id = v_layer.id;
    insert into public.apex_breach_events (breach_id, event_type, event_payload)
      values (p_breach_id, 'layer_broken', jsonb_build_object('layer_index', v_layer.layer_index, 'layer_name', v_layer.name, 'message', v_layer.name || ' breached.'));

    v_next_index := v_session.current_layer_index + 1;
    if v_next_index > 2 then
      perform public.apex_finalize_breach(p_breach_id, 'breached');
      return;
    end if;

    select * into v_next_layer from public.apex_breach_layers where breach_id = p_breach_id and layer_index = v_next_index;
    update public.apex_breach_sessions set current_layer_index = v_next_index where id = p_breach_id;
    insert into public.apex_breach_events (breach_id, event_type, event_payload)
      values (p_breach_id, 'layer_advanced', jsonb_build_object('layer_index', v_next_layer.layer_index, 'message', 'A new defensive layer has been detected ahead.'));
    return;
  end if;

  if v_remaining < 15 then
    perform public.apex_finalize_breach(p_breach_id, 'contained');
    return;
  end if;

  if v_layer.actions_taken >= 4 then
    perform public.apex_finalize_breach(p_breach_id, 'contained');
    return;
  end if;
end;
$$;

revoke all on function public.apex_breach_take_action(uuid, uuid, text, text) from public, anon, authenticated;
