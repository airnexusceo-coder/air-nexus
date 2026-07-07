create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.student_memory_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  memory_enabled boolean not null default true,
  personalize_responses boolean not null default true,
  auto_summary_enabled boolean not null default true,
  disabled_categories text[] not null default '{}',
  retention_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_memory_settings_retention_check check (retention_days is null or retention_days between 30 and 3650)
);

create table if not exists public.student_memory_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary text not null default '',
  subjects text[] not null default '{}',
  learning_style text,
  assignments jsonb not null default '[]'::jsonb,
  weak_topics text[] not null default '{}',
  exam_dates jsonb not null default '[]'::jsonb,
  goals text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.student_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  content text not null,
  source text not null default 'manual',
  confidence numeric(3,2) not null default 0.80,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_memories_type_check check (type in (
    'conversation_summary',
    'subject',
    'learning_style',
    'assignment',
    'weak_topic',
    'exam_date',
    'goal',
    'preference',
    'custom'
  )),
  constraint student_memories_source_check check (source in ('manual', 'automatic', 'conversation', 'import')),
  constraint student_memories_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint student_memories_content_length_check check (char_length(content) <= 8000),
  constraint student_memories_title_length_check check (char_length(title) <= 180)
);

create table if not exists public.student_memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid references public.student_memories(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint student_memory_events_type_check check (event_type in ('created', 'updated', 'deleted', 'searched', 'used_for_ai', 'settings_updated'))
);

create index if not exists student_memories_user_type_idx on public.student_memories(user_id, type) where archived_at is null;
create index if not exists student_memories_user_updated_idx on public.student_memories(user_id, updated_at desc) where archived_at is null;
create index if not exists student_memories_tags_idx on public.student_memories using gin(tags);
create index if not exists student_memories_metadata_idx on public.student_memories using gin(metadata);
create index if not exists student_memories_search_idx on public.student_memories using gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));
create index if not exists student_memory_events_user_created_idx on public.student_memory_events(user_id, created_at desc);

drop trigger if exists set_student_memory_settings_updated_at on public.student_memory_settings;
create trigger set_student_memory_settings_updated_at
before update on public.student_memory_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_student_memories_updated_at on public.student_memories;
create trigger set_student_memories_updated_at
before update on public.student_memories
for each row execute function public.set_updated_at();

drop trigger if exists set_student_memory_profiles_updated_at on public.student_memory_profiles;
create trigger set_student_memory_profiles_updated_at
before update on public.student_memory_profiles
for each row execute function public.set_updated_at();

alter table public.student_memory_settings enable row level security;
alter table public.student_memory_profiles enable row level security;
alter table public.student_memories enable row level security;
alter table public.student_memory_events enable row level security;

drop policy if exists "Users can read their own memory settings" on public.student_memory_settings;
create policy "Users can read their own memory settings"
on public.student_memory_settings for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own memory settings" on public.student_memory_settings;
create policy "Users can insert their own memory settings"
on public.student_memory_settings for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own memory settings" on public.student_memory_settings;
create policy "Users can update their own memory settings"
on public.student_memory_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own memory profile" on public.student_memory_profiles;
create policy "Users can read their own memory profile"
on public.student_memory_profiles for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own memory profile" on public.student_memory_profiles;
create policy "Users can insert their own memory profile"
on public.student_memory_profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own memory profile" on public.student_memory_profiles;
create policy "Users can update their own memory profile"
on public.student_memory_profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own memories" on public.student_memories;
create policy "Users can read their own memories"
on public.student_memories for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own memories" on public.student_memories;
create policy "Users can create their own memories"
on public.student_memories for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own memories" on public.student_memories;
create policy "Users can update their own memories"
on public.student_memories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own memories" on public.student_memories;
create policy "Users can delete their own memories"
on public.student_memories for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their own memory events" on public.student_memory_events;
create policy "Users can read their own memory events"
on public.student_memory_events for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own memory events" on public.student_memory_events;
create policy "Users can create their own memory events"
on public.student_memory_events for insert
with check (auth.uid() = user_id);

create or replace function public.ensure_student_memory_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_memory_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.student_memory_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_student_memory_defaults on auth.users;
create trigger create_student_memory_defaults
after insert on auth.users
for each row execute function public.ensure_student_memory_defaults();

create or replace function public.search_student_memories(search_query text default '', memory_limit integer default 20)
returns table (
  id uuid,
  user_id uuid,
  type text,
  title text,
  content text,
  source text,
  confidence numeric,
  tags text[],
  metadata jsonb,
  archived_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    memory.id,
    memory.user_id,
    memory.type,
    memory.title,
    memory.content,
    memory.source,
    memory.confidence,
    memory.tags,
    memory.metadata,
    memory.archived_at,
    memory.last_used_at,
    memory.created_at,
    memory.updated_at
  from public.student_memories memory
  where
    memory.user_id = auth.uid()
    and memory.archived_at is null
    and (
      coalesce(nullif(trim(search_query), ''), '') = ''
      or to_tsvector('english', coalesce(memory.title, '') || ' ' || coalesce(memory.content, '')) @@ plainto_tsquery('english', search_query)
      or memory.title ilike '%' || search_query || '%'
      or memory.content ilike '%' || search_query || '%'
      or exists (
        select 1
        from unnest(memory.tags) tag
        where tag ilike '%' || search_query || '%'
      )
    )
  order by
    case
      when coalesce(nullif(trim(search_query), ''), '') = '' then 0
      else ts_rank(to_tsvector('english', coalesce(memory.title, '') || ' ' || coalesce(memory.content, '')), plainto_tsquery('english', search_query))
    end desc,
    memory.updated_at desc
  limit least(greatest(memory_limit, 1), 50);
$$;
