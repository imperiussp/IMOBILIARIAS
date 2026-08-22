-- Índices para correlação rápida de webhooks de mensageria.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create index if not exists buyer_outreach_attempts_provider_message_idx
on public.buyer_outreach_delivery_attempts(provider_message_id, attempted_at desc)
where provider_message_id is not null;

create index if not exists buyer_outreach_attempts_channel_recent_idx
on public.buyer_outreach_delivery_attempts(agency_id, channel, attempted_at desc)
where status in ('sending','sent','delivered','read');
