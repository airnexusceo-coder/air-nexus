-- AirGPT — Google Drive integration (Integrations page). Stores the tokens
-- from a real Google OAuth 2.0 flow so AirGPT can list and import a user's
-- own Drive files. One connection per user; owner-only RLS, same trust model
-- as calendar_events/docs (user-scoped PostgREST calls, never service-role).

create table if not exists public.google_oauth_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_google_oauth_connections_updated_at on public.google_oauth_connections;
create trigger set_google_oauth_connections_updated_at before update on public.google_oauth_connections
for each row execute function public.set_updated_at();

alter table public.google_oauth_connections enable row level security;

drop policy if exists "read own google connection" on public.google_oauth_connections;
create policy "read own google connection" on public.google_oauth_connections for select using (auth.uid() = user_id);

drop policy if exists "insert own google connection" on public.google_oauth_connections;
create policy "insert own google connection" on public.google_oauth_connections for insert with check (auth.uid() = user_id);

drop policy if exists "update own google connection" on public.google_oauth_connections;
create policy "update own google connection" on public.google_oauth_connections for update using (auth.uid() = user_id);

drop policy if exists "delete own google connection" on public.google_oauth_connections;
create policy "delete own google connection" on public.google_oauth_connections for delete using (auth.uid() = user_id);
