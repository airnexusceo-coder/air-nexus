-- AirNexus — Admin Console.
-- A fully separate credential/session system from Supabase Auth (the user
-- explicitly asked for a distinct admin sign-in, not a gate on the normal
-- AirNexus login). admin_users/admin_sessions/admin_audit_log carry NO
-- client-facing RLS policy at all — every one is reachable only via the
-- service-role connection from server-only admin API routes
-- (lib/admin/session.ts's requireAdminSession()), never via a normal user's
-- Supabase token, regardless of that user's own role.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null default 'admin',
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references public.admin_users(id),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint admin_users_role_check check (role in ('super_admin', 'admin')),
  constraint admin_users_username_length check (char_length(username) between 3 and 64)
);

create table if not exists public.admin_sessions (
  token text primary key,
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists admin_sessions_admin_user_idx on public.admin_sessions(admin_user_id);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id),
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_admin_user_idx on public.admin_audit_log(admin_user_id, created_at desc);

alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_audit_log enable row level security;
-- Deliberately no policies on any of the three — see header comment.

-- ---------------------------------------------------------------------------
-- profiles: additive moderation columns. requireAuth() (lib/airnexus/http.ts)
-- rejects any request from a user with banned_at/deleted_at set — this is
-- enforced once, centrally, for every existing route for free.
-- ---------------------------------------------------------------------------

-- Suspension is time-boxed (suspended_until) — that's what distinguishes it
-- from a ban, which is indefinite. A suspension with no end date is just a
-- ban with extra steps, so requireAuth() only blocks while now() < suspended_until.
alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists banned_reason text;
alter table public.profiles add column if not exists deleted_at timestamptz;
