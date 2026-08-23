-- Hot paths: preserva integralmente o escopo das policies e apenas evita reavaliar auth.uid() por linha.

alter policy "users read own app notifications"
on public.app_notifications
using ((user_id = (select auth.uid())) and is_agency_member(agency_id));

alter policy "users update own app notifications"
on public.app_notifications
using ((user_id = (select auth.uid())) and is_agency_member(agency_id))
with check ((user_id = (select auth.uid())) and is_agency_member(agency_id));

alter policy "users manage own device tokens"
on public.device_push_tokens
using ((user_id = (select auth.uid())) and is_agency_member(agency_id))
with check ((user_id = (select auth.uid())) and is_agency_member(agency_id));

alter policy "brokers read own tenant profile"
on public.brokers
using ((agency_id in (select current_agency_ids())) and (user_id = (select auth.uid())));

alter policy "tenant brokers read own leads"
on public.leads
using (exists (
  select 1
  from public.brokers b
  where b.id = leads.broker_id
    and b.agency_id = leads.agency_id
    and b.user_id = (select auth.uid())
    and b.active = true
));

alter policy "tenant brokers update own leads"
on public.leads
using (exists (
  select 1
  from public.brokers b
  where b.id = leads.broker_id
    and b.agency_id = leads.agency_id
    and b.user_id = (select auth.uid())
    and b.active = true
))
with check (exists (
  select 1
  from public.brokers b
  where b.id = leads.broker_id
    and b.agency_id = leads.agency_id
    and b.user_id = (select auth.uid())
    and b.active = true
));

alter policy "tenant brokers manage assigned properties"
on public.properties
using (
  can_sell_for_agency(agency_id)
  and exists (
    select 1
    from public.brokers b
    where b.id = properties.broker_id
      and b.agency_id = properties.agency_id
      and b.user_id = (select auth.uid())
      and b.active = true
  )
)
with check (
  can_sell_for_agency(agency_id)
  and exists (
    select 1
    from public.brokers b
    where b.id = properties.broker_id
      and b.agency_id = properties.agency_id
      and b.user_id = (select auth.uid())
      and b.active = true
  )
);

alter policy "tenant brokers manage assigned property photos"
on public.property_photos
using (exists (
  select 1
  from public.properties p
  join public.brokers b on b.id = p.broker_id
  where p.id = property_photos.property_id
    and b.agency_id = p.agency_id
    and b.user_id = (select auth.uid())
    and b.active = true
    and can_sell_for_agency(p.agency_id)
))
with check (exists (
  select 1
  from public.properties p
  join public.brokers b on b.id = p.broker_id
  where p.id = property_photos.property_id
    and b.agency_id = p.agency_id
    and b.user_id = (select auth.uid())
    and b.active = true
    and can_sell_for_agency(p.agency_id)
));

alter policy "tenant brokers manage assigned feature links"
on public.property_feature_links
using (exists (
  select 1
  from public.properties p
  join public.brokers b on b.id = p.broker_id and b.agency_id = p.agency_id
  where p.id = property_feature_links.property_id
    and b.user_id = (select auth.uid())
    and b.active = true
    and can_sell_for_agency(p.agency_id)
))
with check (exists (
  select 1
  from public.properties p
  join public.brokers b on b.id = p.broker_id and b.agency_id = p.agency_id
  where p.id = property_feature_links.property_id
    and b.user_id = (select auth.uid())
    and b.active = true
    and can_sell_for_agency(p.agency_id)
));

create index if not exists app_notifications_agency_id_idx
  on public.app_notifications (agency_id);
create index if not exists app_notifications_broker_id_idx
  on public.app_notifications (broker_id);
create index if not exists app_notifications_lead_id_idx
  on public.app_notifications (lead_id);
create index if not exists leads_first_response_by_idx
  on public.leads (first_response_by);
