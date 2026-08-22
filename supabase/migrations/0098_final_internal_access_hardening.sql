-- Endurecimento final de acesso interno por imobiliária/corretor.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.
-- Esta migration depende dos helpers criados nas migrations anteriores.

-- Histórico de ciclo de vida: gestor/staff enxerga a carteira da agência;
-- corretor comum somente os imóveis vinculados ao seu próprio cadastro.
drop policy if exists "tenant members read property history" on public.property_status_history;
create policy "tenant members read property history" on public.property_status_history
for select to authenticated
using (public.can_access_property_internal(agency_id,property_id));

-- O histórico de preços segue exatamente a mesma regra de acesso interno.
drop policy if exists "tenant members read property price history" on public.property_price_history;
create policy "tenant members read property price history" on public.property_price_history
for select to authenticated
using (public.can_access_property_internal(agency_id,property_id));

-- Garante que o checklist documental não possa ser manipulado por usuário fora da
-- carteira permitida, mesmo que uma policy antiga tenha permanecido no banco.
drop policy if exists "tenant members manage property documents" on public.property_document_items;
create policy "tenant members manage property documents" on public.property_document_items
for all to authenticated
using (public.can_access_property_internal(agency_id,property_id))
with check (public.can_access_property_internal(agency_id,property_id));

-- Preferências e matching contêm informação comercial do comprador e seguem o CRM.
drop policy if exists "tenant members manage lead preferences" on public.lead_property_preferences;
create policy "tenant members manage lead preferences" on public.lead_property_preferences
for all to authenticated
using (public.can_access_lead_crm(agency_id,lead_id))
with check (public.can_access_lead_crm(agency_id,lead_id));

-- Visitas também seguem a permissão do contato atribuído.
drop policy if exists "tenant members read property visits" on public.property_visit_appointments;
create policy "tenant members read property visits" on public.property_visit_appointments
for select to authenticated
using (public.can_access_lead_crm(agency_id,lead_id));

drop policy if exists "tenant members manage property visits" on public.property_visit_appointments;
create policy "tenant members manage property visits" on public.property_visit_appointments
for all to authenticated
using (public.can_access_lead_crm(agency_id,lead_id))
with check (public.can_access_lead_crm(agency_id,lead_id));

-- Remove privilégios diretos de escrita em tabelas de histórico gerenciadas apenas por triggers.
revoke insert,update,delete on public.property_status_history from anon,authenticated;
revoke insert,update,delete on public.property_price_history from anon,authenticated;

-- Reforça grants mínimos das views internas.
revoke all on public.agency_property_lifecycle_summary from public,anon;
revoke all on public.agency_recent_price_changes from public,anon;
revoke all on public.agency_property_document_summary from public,anon;
revoke all on public.lead_property_match_candidates from public,anon;
revoke all on public.agency_visit_schedule_summary from public,anon;
revoke all on public.agency_property_commercial_performance from public,anon;
revoke all on public.agency_broker_performance from public,anon;

grant select on public.agency_property_lifecycle_summary to authenticated;
grant select on public.agency_recent_price_changes to authenticated;
grant select on public.agency_property_document_summary to authenticated;
grant select on public.lead_property_match_candidates to authenticated;
grant select on public.agency_visit_schedule_summary to authenticated;
grant select on public.agency_property_commercial_performance to authenticated;
grant select on public.agency_broker_performance to authenticated;
