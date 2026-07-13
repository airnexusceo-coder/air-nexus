-- Apex basic defence setup cost rebalance.
-- Normal Vault setup defences are included and only spend Core Energy when
-- installed/reactivated. Nexus Points are reserved for advanced-strength
-- defence systems. Breach technologies can be unlocked without NP.

update public.apex_technologies
set np_acquisition_cost = 0
where technology_type = 'defence'
  and slug in ('mirage', 'firewall', 'core-lock', 'ghost-layer', 'counter-trace');

update public.apex_technologies
set np_acquisition_cost = case slug
  when 'core-shield' then 150
  when 'signal-redirect' then 160
  when 'fortress-core' then 260
  else np_acquisition_cost
end
where technology_type = 'defence'
  and slug in ('core-shield', 'signal-redirect', 'fortress-core');
update public.apex_technologies
set np_acquisition_cost = 0
where technology_type = 'breach';