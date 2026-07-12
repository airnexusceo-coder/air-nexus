-- AirNexus — real shareable documents ("Docs"). Replaces the old Documents
-- page, which was a single hardcoded fake "Q4 Strategy Brief" and later a
-- single per-user localStorage document — neither could be shared with
-- another person. Named "docs" (not "documents") to stay distinct from the
-- unrelated `lib/documents/*` chat-attachment-extraction code already in
-- this codebase. No realtime layer: the client polls for changes, consistent
-- with Rooms (0005) and the rest of this codebase's architecture.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.docs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled document',
  body text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint docs_title_length check (char_length(title) between 1 and 200)
);
create index if not exists docs_owner_idx on public.docs(owner_id);

-- Sharing is open to any user found via search (Player Discovery), not
-- gated to friends like Rooms — closer to how Google Docs sharing works.
create table if not exists public.doc_collaborators (
  doc_id uuid not null references public.docs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  -- Denormalized at share-time: avoids a second RLS-scoped profile lookup
  -- just to render the collaborator list back to the owner.
  display_name text not null,
  added_at timestamptz not null default now(),
  primary key (doc_id, user_id),
  constraint doc_collaborators_role_check check (role in ('editor', 'viewer'))
);
create index if not exists doc_collaborators_user_idx on public.doc_collaborators(user_id);

drop trigger if exists set_docs_updated_at on public.docs;
create trigger set_docs_updated_at before update on public.docs
for each row execute function public.set_updated_at();

-- Extend the existing notifications type allowlist (0005) with 'doc_shared'
-- rather than misusing 'room_invite' for a doc share.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('room_invite', 'task_assigned', 'task_completed', 'doc_shared'));

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.docs enable row level security;
alter table public.doc_collaborators enable row level security;

drop policy if exists "read own docs" on public.docs;
create policy "read own docs" on public.docs for select using (auth.uid() = owner_id);

drop policy if exists "read shared docs" on public.docs;
create policy "read shared docs" on public.docs for select using (
  exists (select 1 from public.doc_collaborators c where c.doc_id = id and c.user_id = auth.uid())
);

drop policy if exists "insert own docs" on public.docs;
create policy "insert own docs" on public.docs for insert with check (auth.uid() = owner_id);

drop policy if exists "update own docs" on public.docs;
create policy "update own docs" on public.docs for update using (auth.uid() = owner_id);

-- A second, additive update policy: editors may update content, but never
-- reassign ownership (owner_id is excluded from the client's update payload
-- at the application layer — this policy only gates row-level access).
drop policy if exists "update as editor" on public.docs;
create policy "update as editor" on public.docs for update using (
  exists (select 1 from public.doc_collaborators c where c.doc_id = id and c.user_id = auth.uid() and c.role = 'editor')
);

drop policy if exists "delete own docs" on public.docs;
create policy "delete own docs" on public.docs for delete using (auth.uid() = owner_id);

-- doc_collaborators: a collaborator sees their own membership row (so a
-- shared doc shows up in "Shared with me"); only the owner sees/manages the
-- full collaborator list — no client insert/update/delete, only via
-- airnexus_share_doc / airnexus_unshare_doc below.
drop policy if exists "read own collaboration" on public.doc_collaborators;
create policy "read own collaboration" on public.doc_collaborators for select using (auth.uid() = user_id);

drop policy if exists "owner reads collaborators" on public.doc_collaborators;
create policy "owner reads collaborators" on public.doc_collaborators for select using (
  exists (select 1 from public.docs d where d.id = doc_id and d.owner_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- airnexus_share_doc — caller must own the doc; target must be a real user
-- (found via airnexus_search_profiles, same as Player Discovery). Upserts so
-- re-sharing with a different role just changes the role instead of erroring.
create or replace function public.airnexus_share_doc(p_doc_id uuid, p_target_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_doc_title text;
begin
  if p_role not in ('editor', 'viewer') then
    raise exception 'Role must be editor or viewer';
  end if;
  select title into v_doc_title from public.docs where id = p_doc_id and owner_id = auth.uid();
  if v_doc_title is null then
    raise exception 'You do not own this document';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'You already own this document';
  end if;

  select display_name into v_display_name from public.profiles where user_id = p_target_user_id;
  if v_display_name is null then
    raise exception 'That person could not be found';
  end if;

  insert into public.doc_collaborators (doc_id, user_id, role, display_name)
  values (p_doc_id, p_target_user_id, p_role, v_display_name)
  on conflict (doc_id, user_id) do update set role = excluded.role, display_name = excluded.display_name;

  perform public.airnexus_notify(p_target_user_id, 'doc_shared', 'Shared "' || v_doc_title || '" with you', '', null, null);
end;
$$;

revoke all on function public.airnexus_share_doc(uuid, uuid, text) from public, anon;
grant execute on function public.airnexus_share_doc(uuid, uuid, text) to authenticated;

-- airnexus_unshare_doc — owner-only removal.
create or replace function public.airnexus_unshare_doc(p_doc_id uuid, p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.docs where id = p_doc_id and owner_id = auth.uid()) then
    raise exception 'You do not own this document';
  end if;
  delete from public.doc_collaborators where doc_id = p_doc_id and user_id = p_target_user_id;
end;
$$;

revoke all on function public.airnexus_unshare_doc(uuid, uuid) from public, anon;
grant execute on function public.airnexus_unshare_doc(uuid, uuid) to authenticated;
