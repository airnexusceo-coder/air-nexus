-- AirNexus ? signed admin Nexus Points adjustments.
-- 0019 introduced positive-only point gifts. This expands the same pending
-- adjustment table so admins can also remove points. Users claim these rows
-- on app open; positive rows add points, negative rows subtract without
-- letting the local wallet fall below zero.

alter table public.nexus_point_grants drop constraint if exists nexus_point_grants_amount_positive;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nexus_point_grants_amount_signed') then
    alter table public.nexus_point_grants add constraint nexus_point_grants_amount_signed check (amount <> 0 and amount between -1000000 and 1000000);
  end if;
end $$;
