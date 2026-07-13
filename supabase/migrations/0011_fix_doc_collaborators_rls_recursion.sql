-- Fixes "infinite recursion detected in policy for relation doc_collaborators"
-- from migration 0009: doc_collaborators' "owner reads collaborators" policy
-- queried public.docs, and public.docs' own "read shared docs"/"update as
-- editor" policies queried back into public.doc_collaborators — a cycle
-- Postgres's RLS planner cannot resolve.
--
-- Fix: move the ownership check into a SECURITY DEFINER function. The
-- function is owned by the same role that owns public.docs, so its internal
-- query runs as the table owner and bypasses RLS entirely (a table owner is
-- exempt from its own RLS policies unless FORCE ROW LEVEL SECURITY is set,
-- which it isn't here) — so the recursive policy path is never entered.

create or replace function public.airnexus_owns_doc(p_doc_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.docs where id = p_doc_id and owner_id = auth.uid()
  );
$$;

revoke all on function public.airnexus_owns_doc(uuid) from public, anon;
grant execute on function public.airnexus_owns_doc(uuid) to authenticated;

drop policy if exists "owner reads collaborators" on public.doc_collaborators;
create policy "owner reads collaborators" on public.doc_collaborators for select using (
  public.airnexus_owns_doc(doc_id)
);
