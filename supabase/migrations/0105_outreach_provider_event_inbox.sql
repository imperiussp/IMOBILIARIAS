-- Caixa durável para eventos de provedor que chegam antes da correlação da tentativa.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create table if not exists public.outreach_provider_event_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_message_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_attempts integer not null default 0,
  last_error text,
  unique(provider,provider_event_id)
);

create index if not exists outreach_provider_event_inbox_pending_idx
on public.outreach_provider_event_inbox(received_at)
where processed_at is null;

create index if not exists outreach_provider_event_inbox_message_idx
on public.outreach_provider_event_inbox(provider_message_id)
where processed_at is null;

alter table public.outreach_provider_event_inbox enable row level security;
revoke all on public.outreach_provider_event_inbox from public,anon,authenticated;

-- Visibilidade operacional somente para administradores da plataforma.
drop policy if exists "platform admins read provider event inbox" on public.outreach_provider_event_inbox;
create policy "platform admins read provider event inbox"
on public.outreach_provider_event_inbox
for select to authenticated
using (public.is_platform_admin());

grant select on public.outreach_provider_event_inbox to authenticated;
