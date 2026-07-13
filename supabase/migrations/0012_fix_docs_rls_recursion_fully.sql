-- 0011 only broke the recursion cycle from one direction (doc_collaborators
-- -> docs). public.docs' own "read shared docs" and "update as editor"
-- policies still directly subquery public.doc_collaborators, which is enough
-- on its own to retrigger "infinite recursion detected in policy for
-- relation doc_collaborators". This migration removes every direct
-- cross-table subquery from both tables' policies, routing all of them
-- through SECURITY DEFINER functions instead — each function is owned by
-- the same role that owns these tables, so its internal query bypasses RLS
-- entirely (table owners are exempt from their own RLS policies unless
-- FORCE ROW LEVEL SECURITY is set, which it isn't here). With no policy on
-- either table directly querying the other, there is no cycle left to
-- detect, structurally or at runtime.

create or replace function public.airnexus_is_doc_collaborator(p_doc_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.doc_collaborators where doc_id = p_doc_id and user_id = auth.uid()
  );
$$;

create or replace function public.airnexus_is_doc_editor(p_doc_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.doc_collaborators where doc_id = p_doc_id and user_id = auth.uid() and role = 'editor'
  );
$$;

revoke all on function public.airnexus_is_doc_collaborator(uuid) from public, anon;
grant execute on function public.airnexus_is_doc_collaborator(uuid) to authenticated;

revoke all on function public.airnexus_is_doc_editor(uuid) from public, anon;
grant execute on function public.airnexus_is_doc_editor(uuid) to authenticated;

drop policy if exists "read shared docs" on public.docs;
create policy "read shared docs" on public.docs for select using (
  public.airnexus_is_doc_collaborator(id)
);

drop policy if exists "update as editor" on public.docs;
create policy "update as editor" on public.docs for update using (
  public.airnexus_is_doc_editor(id)
);
