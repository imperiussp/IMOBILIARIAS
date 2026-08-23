-- Complete the remaining high-value FK indexes identified during homologation.
-- These are additive only; existing composite indexes are intentionally preserved.

create index if not exists agency_assets_broker_id_idx on public.agency_assets(broker_id);
create index if not exists agency_assets_created_by_idx on public.agency_assets(created_by);
create index if not exists agency_assets_document_id_idx on public.agency_assets(document_id);
create index if not exists agency_assets_property_id_idx on public.agency_assets(property_id);

create index if not exists agency_document_versions_created_by_idx on public.agency_document_versions(created_by);

create index if not exists agency_documents_created_by_idx on public.agency_documents(created_by);
create index if not exists agency_documents_lead_id_idx on public.agency_documents(lead_id);
create index if not exists agency_documents_property_id_idx on public.agency_documents(property_id);
create index if not exists agency_documents_template_id_idx on public.agency_documents(template_id);

create index if not exists agency_inbound_emails_broker_id_idx on public.agency_inbound_emails(broker_id);
create index if not exists agency_invitations_broker_id_idx on public.agency_invitations(broker_id);

create index if not exists audit_log_user_id_idx on public.audit_log(user_id);
create index if not exists billing_checkout_sessions_created_by_idx on public.billing_checkout_sessions(created_by);
create index if not exists billing_events_agency_id_idx on public.billing_events(agency_id);
create index if not exists broker_monthly_goals_created_by_idx on public.broker_monthly_goals(created_by);
create index if not exists lead_property_preferences_lead_id_idx on public.lead_property_preferences(lead_id);
create index if not exists property_price_history_property_id_idx on public.property_price_history(property_id);
