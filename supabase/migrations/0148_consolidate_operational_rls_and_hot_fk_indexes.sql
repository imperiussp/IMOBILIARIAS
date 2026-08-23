drop policy if exists "platform admins manage inbound emails" on public.agency_inbound_emails;
drop policy if exists "tenant managers read inbound emails" on public.agency_inbound_emails;
create policy "admins or tenant managers read inbound emails" on public.agency_inbound_emails for select to authenticated using (is_platform_admin() or can_manage_agency(agency_id));
create policy "platform admins insert inbound emails" on public.agency_inbound_emails for insert to authenticated with check (is_platform_admin());
create policy "platform admins update inbound emails" on public.agency_inbound_emails for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy "platform admins delete inbound emails" on public.agency_inbound_emails for delete to authenticated using (is_platform_admin());

drop policy if exists "platform admins manage invitations" on public.agency_invitations;
drop policy if exists "tenant managers read own invitations" on public.agency_invitations;
create policy "admins or tenant managers read invitations" on public.agency_invitations for select to authenticated using (is_platform_admin() or can_manage_agency(agency_id));
create policy "platform admins insert invitations" on public.agency_invitations for insert to authenticated with check (is_platform_admin());
create policy "platform admins update invitations" on public.agency_invitations for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy "platform admins delete invitations" on public.agency_invitations for delete to authenticated using (is_platform_admin());

drop policy if exists "platform admins manage subscriptions" on public.agency_subscriptions;
drop policy if exists "tenant members read own subscription" on public.agency_subscriptions;
create policy "members or platform admins read subscriptions" on public.agency_subscriptions for select to authenticated using (is_platform_admin() or agency_id in (select current_agency_ids()));
create policy "platform admins insert subscriptions" on public.agency_subscriptions for insert to authenticated with check (is_platform_admin());
create policy "platform admins update subscriptions" on public.agency_subscriptions for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy "platform admins delete subscriptions" on public.agency_subscriptions for delete to authenticated using (is_platform_admin());

drop policy if exists "platform admins manage ai usage" on public.ai_usage_events;
drop policy if exists "tenant members create own ai usage" on public.ai_usage_events;
drop policy if exists "tenant managers read own ai usage" on public.ai_usage_events;
create policy "admins or tenant managers read ai usage" on public.ai_usage_events for select to authenticated using (is_admin() or can_manage_agency(agency_id));
create policy "admins or tenant members insert ai usage" on public.ai_usage_events for insert to authenticated with check (is_admin() or (((select auth.uid()) = user_id) and is_agency_member(agency_id)));
create policy "platform admins update ai usage" on public.ai_usage_events for update to authenticated using (is_admin()) with check (is_admin());
create policy "platform admins delete ai usage" on public.ai_usage_events for delete to authenticated using (is_admin());

drop policy if exists "platform admins read audit log" on public.audit_log;
drop policy if exists "tenant managers read own audit log" on public.audit_log;
create policy "admins or tenant managers read audit log" on public.audit_log for select to authenticated using (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));

drop policy if exists "platform admins manage checkout sessions" on public.billing_checkout_sessions;
drop policy if exists "tenant managers read checkout sessions" on public.billing_checkout_sessions;
create policy "admins or tenant managers read checkout sessions" on public.billing_checkout_sessions for select to authenticated using (is_platform_admin() or can_manage_agency(agency_id));
create policy "platform admins insert checkout sessions" on public.billing_checkout_sessions for insert to authenticated with check (is_platform_admin());
create policy "platform admins update checkout sessions" on public.billing_checkout_sessions for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy "platform admins delete checkout sessions" on public.billing_checkout_sessions for delete to authenticated using (is_platform_admin());

drop policy if exists "platform admins manage billing customers" on public.billing_customers;
drop policy if exists "tenant managers read billing customer" on public.billing_customers;
create policy "admins or tenant managers read billing customers" on public.billing_customers for select to authenticated using (is_platform_admin() or can_manage_agency(agency_id));
create policy "platform admins insert billing customers" on public.billing_customers for insert to authenticated with check (is_platform_admin());
create policy "platform admins update billing customers" on public.billing_customers for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy "platform admins delete billing customers" on public.billing_customers for delete to authenticated using (is_platform_admin());

drop policy if exists "tenant managers manage broker goals" on public.broker_monthly_goals;
drop policy if exists "tenant members read broker goals" on public.broker_monthly_goals;
create policy "tenant members or managers read broker goals" on public.broker_monthly_goals for select to authenticated using (can_manage_agency(agency_id) or is_platform_admin() or exists (select 1 from public.brokers b where b.id=broker_monthly_goals.broker_id and b.agency_id=broker_monthly_goals.agency_id and b.user_id=(select auth.uid()) and b.active=true));
create policy "tenant managers insert broker goals" on public.broker_monthly_goals for insert to authenticated with check (can_manage_agency(agency_id) or is_platform_admin());
create policy "tenant managers update broker goals" on public.broker_monthly_goals for update to authenticated using (can_manage_agency(agency_id) or is_platform_admin()) with check (can_manage_agency(agency_id) or is_platform_admin());
create policy "tenant managers delete broker goals" on public.broker_monthly_goals for delete to authenticated using (can_manage_agency(agency_id) or is_platform_admin());

drop policy if exists "platform admins manage global neighborhoods" on public.neighborhoods;
drop policy if exists "tenant managers manage neighborhoods" on public.neighborhoods;
drop policy if exists "read global or tenant neighborhoods" on public.neighborhoods;
create policy "anonymous read global neighborhoods" on public.neighborhoods for select to anon using (agency_id is null);
create policy "members or admins read neighborhoods" on public.neighborhoods for select to authenticated using ((agency_id is null) or is_admin() or ((agency_id is not null) and is_agency_member(agency_id)));
create policy "admins or tenant managers insert neighborhoods" on public.neighborhoods for insert to authenticated with check (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));
create policy "admins or tenant managers update neighborhoods" on public.neighborhoods for update to authenticated using (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id))) with check (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));
create policy "admins or tenant managers delete neighborhoods" on public.neighborhoods for delete to authenticated using (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));

drop policy if exists "platform admins manage global property features" on public.property_features;
drop policy if exists "tenant managers manage property features" on public.property_features;
drop policy if exists "read global or tenant property features" on public.property_features;
create policy "anonymous read global property features" on public.property_features for select to anon using (agency_id is null);
create policy "members or admins read property features" on public.property_features for select to authenticated using ((agency_id is null) or is_admin() or ((agency_id is not null) and is_agency_member(agency_id)));
create policy "admins or tenant managers insert property features" on public.property_features for insert to authenticated with check (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));
create policy "admins or tenant managers update property features" on public.property_features for update to authenticated using (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id))) with check (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));
create policy "admins or tenant managers delete property features" on public.property_features for delete to authenticated using (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));

drop policy if exists "platform admins manage global property types" on public.property_types;
drop policy if exists "tenant managers manage property types" on public.property_types;
drop policy if exists "read global or tenant property types" on public.property_types;
create policy "anonymous read active global property types" on public.property_types for select to anon using ((agency_id is null) and active=true);
create policy "members or admins read property types" on public.property_types for select to authenticated using (((agency_id is null) and active=true) or is_admin() or ((agency_id is not null) and is_agency_member(agency_id)));
create policy "admins or tenant managers insert property types" on public.property_types for insert to authenticated with check (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));
create policy "admins or tenant managers update property types" on public.property_types for update to authenticated using (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id))) with check (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));
create policy "admins or tenant managers delete property types" on public.property_types for delete to authenticated using (is_admin() or ((agency_id is not null) and can_manage_agency(agency_id)));

drop policy if exists "tenant members read property visits" on public.property_visit_appointments;

drop policy if exists "platform admins manage legacy roles" on public.user_roles;
drop policy if exists "users read own role" on public.user_roles;
create policy "users or platform admins read legacy roles" on public.user_roles for select to authenticated using (((select auth.uid())=user_id) or is_platform_admin());
create policy "platform admins insert legacy roles" on public.user_roles for insert to authenticated with check (is_platform_admin());
create policy "platform admins update legacy roles" on public.user_roles for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy "platform admins delete legacy roles" on public.user_roles for delete to authenticated using (is_platform_admin());

create index if not exists lead_activity_events_lead_id_idx on public.lead_activity_events(lead_id);
create index if not exists lead_followups_assigned_user_id_idx on public.lead_followups(assigned_user_id);
create index if not exists lead_followups_lead_id_idx on public.lead_followups(lead_id);
create index if not exists lead_notes_lead_id_idx on public.lead_notes(lead_id);
create index if not exists property_visit_appointments_broker_id_idx on public.property_visit_appointments(broker_id);
create index if not exists property_visit_appointments_lead_id_idx on public.property_visit_appointments(lead_id);
create index if not exists property_visit_appointments_property_id_idx on public.property_visit_appointments(property_id);
create index if not exists broker_monthly_goals_broker_id_idx on public.broker_monthly_goals(broker_id);
