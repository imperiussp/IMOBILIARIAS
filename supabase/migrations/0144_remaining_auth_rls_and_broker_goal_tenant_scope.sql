-- Otimiza as policies restantes para evitar reavaliacao de auth.uid() por linha.
-- Tambem corrige o escopo de tenant das metas de corretores, vinculando broker e meta pela mesma agency_id.

alter policy "agency managers read member profiles"
on public.profiles
using (
  ((select auth.uid()) = user_id)
  or is_admin()
  or exists (
    select 1
    from public.agency_memberships manager
    join public.agency_memberships member on member.agency_id = manager.agency_id
    where manager.user_id = (select auth.uid())
      and manager.active = true
      and manager.role = any (array['owner'::text, 'admin'::text])
      and member.user_id = profiles.user_id
      and member.active = true
  )
);

alter policy "read global or tenant neighborhoods"
on public.neighborhoods
using (
  agency_id is null
  or (((select auth.uid()) is not null) and (is_admin() or is_agency_member(agency_id)))
);

alter policy "read global or tenant property types"
on public.property_types
using (
  ((agency_id is null) and (active = true))
  or (((select auth.uid()) is not null) and is_admin())
  or ((agency_id is not null) and ((select auth.uid()) is not null) and is_agency_member(agency_id))
);

alter policy "read global or tenant property features"
on public.property_features
using (
  agency_id is null
  or (((select auth.uid()) is not null) and (is_admin() or is_agency_member(agency_id)))
);

alter policy "tenant members create own ai usage"
on public.ai_usage_events
with check (
  user_id = (select auth.uid())
  and is_agency_member(agency_id)
);

alter policy "tenant members read broker goals"
on public.broker_monthly_goals
using (
  can_manage_agency(agency_id)
  or is_platform_admin()
  or exists (
    select 1
    from public.brokers b
    where b.id = broker_monthly_goals.broker_id
      and b.agency_id = broker_monthly_goals.agency_id
      and b.user_id = (select auth.uid())
      and b.active = true
  )
);
