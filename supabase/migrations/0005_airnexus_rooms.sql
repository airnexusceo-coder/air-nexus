-- AirNexus — real Collaboration Rooms + Notifications.
-- Replaces the hardcoded fake collaborators ("Aarav T.", "Elena M.", etc.)
-- that previously stood in for room membership/chat/tasks/notifications in
-- the UI. Rooms use N-ARY membership (room_members) rather than the existing
-- `friendships` table, which is a 1-to-1 bidirectional pair and not suited to
-- group rooms. `airnexus_add_room_member` only allows adding accepted
-- friends, reusing that existing trust graph rather than opening rooms to
-- arbitrary user_ids. No realtime layer: room chat is polled by the client,
-- consistent with the rest of this codebase's raw-PostgREST-fetch,
-- no-SDK-realtime architecture.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_name_length check (char_length(name) between 1 and 80)
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_members_role_check check (role in ('owner', 'member'))
);
create index if not exists room_members_user_idx on public.room_members(user_id);

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint room_messages_body_length check (char_length(body) between 1 and 4000)
);
create index if not exists room_messages_room_created_idx on public.room_messages(room_id, created_at);

-- Real per-room tasks — replaces both the old static `milestones` mock table
-- and the disconnected local task list that used to live in the chat panel.
create table if not exists public.room_tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  status text not null default 'todo',
  assignee_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_tasks_title_length check (char_length(title) between 1 and 200),
  constraint room_tasks_status_check check (status in ('todo', 'in_progress', 'done'))
);
create index if not exists room_tasks_room_idx on public.room_tasks(room_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  room_id uuid references public.rooms(id) on delete cascade,
  task_id uuid references public.room_tasks(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('room_invite', 'task_assigned', 'task_completed'))
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id) where read = false;

-- updated_at triggers (public.set_updated_at() already defined in 0002_airnexus_social_economy.sql)
drop trigger if exists set_rooms_updated_at on public.rooms;
create trigger set_rooms_updated_at before update on public.rooms
for each row execute function public.set_updated_at();

drop trigger if exists set_room_tasks_updated_at on public.room_tasks;
create trigger set_room_tasks_updated_at before update on public.room_tasks
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_messages enable row level security;
alter table public.room_tasks enable row level security;
alter table public.notifications enable row level security;

-- rooms: readable only by members. No client insert/update/delete policy —
-- creation only via airnexus_create_room.
drop policy if exists "read my rooms" on public.rooms;
create policy "read my rooms" on public.rooms for select using (
  exists (select 1 from public.room_members m where m.room_id = rooms.id and m.user_id = auth.uid())
);

-- room_members: self-referential EXISTS so a member sees every fellow
-- member's row, not just their own. No client insert/update/delete — only
-- via airnexus_create_room (initial owner row) and airnexus_add_room_member.
drop policy if exists "read fellow room members" on public.room_members;
create policy "read fellow room members" on public.room_members for select using (
  exists (select 1 from public.room_members m2 where m2.room_id = room_members.room_id and m2.user_id = auth.uid())
);

-- room_messages: members read + post their own; append-only (no update/delete policy).
drop policy if exists "read room messages" on public.room_messages;
create policy "read room messages" on public.room_messages for select using (
  exists (select 1 from public.room_members m where m.room_id = room_messages.room_id and m.user_id = auth.uid())
);
drop policy if exists "post room messages" on public.room_messages;
create policy "post room messages" on public.room_messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.room_members m where m.room_id = room_messages.room_id and m.user_id = auth.uid())
);

-- room_tasks: any member may read/create/update/delete any task in a room
-- they belong to. Deliberately flat — a shared room implies a shared trust
-- model, no owner/member permission tiers for this pass.
drop policy if exists "manage room tasks" on public.room_tasks;
create policy "manage room tasks" on public.room_tasks for all using (
  exists (select 1 from public.room_members m where m.room_id = room_tasks.room_id and m.user_id = auth.uid())
) with check (
  exists (select 1 from public.room_members m where m.room_id = room_tasks.room_id and m.user_id = auth.uid())
);

-- notifications: strictly own-row. No client insert policy at all — every
-- row is created by airnexus_notify, which is revoked from client roles
-- below (a user's own token must never be able to write into someone else's
-- notifications).
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- airnexus_notify — the only path a notification row can be created through.
-- Cross-user write (the caller is never the recipient), so it's revoked from
-- authenticated/anon below and only reachable via the service-role backend.
create or replace function public.airnexus_notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_room_id uuid default null,
  p_task_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, room_id, task_id)
  values (p_user_id, p_type, p_title, p_body, p_room_id, p_task_id);
end;
$$;

revoke all on function public.airnexus_notify(uuid, text, text, text, uuid, uuid) from public, anon, authenticated;

-- airnexus_create_room — atomic room + owner-membership creation in one
-- round trip. Callable with the caller's own token (like
-- airnexus_send_friend_request in 0002), SECURITY DEFINER only so it can
-- perform both inserts atomically.
create or replace function public.airnexus_create_room(p_name text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_name);
  v_room public.rooms;
begin
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'Enter a room name (1-80 characters).';
  end if;

  insert into public.rooms (name, created_by) values (v_name, auth.uid()) returning * into v_room;
  insert into public.room_members (room_id, user_id, role) values (v_room.id, auth.uid(), 'owner');

  return v_room;
end;
$$;

-- airnexus_add_room_member — caller must already be a member; the target
-- must be an accepted friend (reuses the existing friend graph rather than
-- allowing arbitrary user_ids into a room). Dispatches a room_invite
-- notification atomically with the membership insert.
create or replace function public.airnexus_add_room_member(p_room_id uuid, p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_name text;
begin
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'You are not a member of this room';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'You are already a member of this room';
  end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = p_target_user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = p_target_user_id))
  ) then
    raise exception 'You can only add accepted friends to a room';
  end if;
  if exists (select 1 from public.room_members where room_id = p_room_id and user_id = p_target_user_id) then
    raise exception 'Already a member of this room';
  end if;

  select name into v_room_name from public.rooms where id = p_room_id;
  insert into public.room_members (room_id, user_id, role) values (p_room_id, p_target_user_id, 'member');
  perform public.airnexus_notify(p_target_user_id, 'room_invite', 'Added to ' || v_room_name, '', p_room_id, null);
end;
$$;
