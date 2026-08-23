-- Oportunidades automáticas de imóveis para compradores, com consentimento e fila segura.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.buyer_outreach_settings (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  enabled boolean not null default false,
  auto_contact boolean not null default false,
  min_match_score integer not null default 80 check (min_match_score between 0 and 100),
  cooldown_hours integer not null default 72 check (cooldown_hours between 1 and 720),
  channels text[] not null default array['whatsapp']::text[],
  require_explicit_consent boolean not null default true,
  notify_broker boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_contact_permissions (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  whatsapp_allowed boolean not null default false,
  email_allowed boolean not null default false,
  sms_allowed boolean not null default false,
  automated_property_alerts_allowed boolean not null default false,
  consent_source text,
  consent_at timestamptz,
  revoked_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (agency_id, lead_id)
);

create table if not exists public.buyer_property_opportunities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  match_score integer not null check (match_score between 0 and 100),
  trigger_source text not null default 'property_published' check (trigger_source in ('property_published','property_updated','manual','scheduled_scan')),
  status text not null default 'queued' check (status in ('queued','review','approved','sent','skipped','failed','cancelled')),
  channel text,
  ai_message text,
  ai_provider text,
  skip_reason text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, lead_id, property_id)
);

create index if not exists buyer_property_opportunities_agency_status_idx on public.buyer_property_opportunities(agency_id,status,created_at desc);
create index if not exists buyer_property_opportunities_lead_idx on public.buyer_property_opportunities(agency_id,lead_id,created_at desc);
create index if not exists buyer_property_opportunities_property_idx on public.buyer_property_opportunities(agency_id,property_id,created_at desc);

alter table public.buyer_outreach_settings enable row level security;
alter table public.lead_contact_permissions enable row level security;
alter table public.buyer_property_opportunities enable row level security;

drop policy if exists "tenant managers manage buyer outreach settings" on public.buyer_outreach_settings;
create policy "tenant managers manage buyer outreach settings" on public.buyer_outreach_settings
for all to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin())
with check (public.can_manage_agency(agency_id) or public.is_platform_admin());

drop policy if exists "tenant members manage lead contact permissions" on public.lead_contact_permissions;
create policy "tenant members manage lead contact permissions" on public.lead_contact_permissions
for all to authenticated
using (public.can_access_lead_crm(agency_id,lead_id))
with check (public.can_access_lead_crm(agency_id,lead_id));

drop policy if exists "tenant members read buyer opportunities" on public.buyer_property_opportunities;
create policy "tenant members read buyer opportunities" on public.buyer_property_opportunities
for select to authenticated
using (public.can_access_lead_crm(agency_id,lead_id));

drop policy if exists "tenant managers manage buyer opportunities" on public.buyer_property_opportunities;
create policy "tenant managers manage buyer opportunities" on public.buyer_property_opportunities
for update to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin())
with check (public.can_manage_agency(agency_id) or public.is_platform_admin());

create or replace function public.validate_lead_contact_permission_tenant()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.leads l where l.id=new.lead_id and l.agency_id=new.agency_id) then raise exception 'Contato fora da imobiliária atual.'; end if;
  if not public.can_access_lead_crm(new.agency_id,new.lead_id) then raise exception 'Sem permissão para alterar consentimento deste contato.'; end if;
  new.updated_by := coalesce(auth.uid(),new.updated_by);
  new.updated_at := now();
  if new.automated_property_alerts_allowed then new.consent_at := coalesce(new.consent_at,now()); new.revoked_at := null; else new.revoked_at := coalesce(new.revoked_at,now()); end if;
  return new;
end; $$;
revoke all on function public.validate_lead_contact_permission_tenant() from public,anon,authenticated;
drop trigger if exists lead_contact_permissions_validate on public.lead_contact_permissions;
create trigger lead_contact_permissions_validate before insert or update on public.lead_contact_permissions for each row execute function public.validate_lead_contact_permission_tenant();

create or replace function public.queue_property_buyer_matches(p_property_id uuid, p_trigger_source text default 'manual')
returns integer language plpgsql security definer set search_path=public as $$
declare v_agency uuid; v_count integer := 0; v_settings public.buyer_outreach_settings%rowtype;
begin
  select agency_id into v_agency from public.properties where id=p_property_id and publication_state='published' and status='available';
  if v_agency is null then return 0; end if;
  if auth.uid() is not null and not public.can_access_property_internal(v_agency,p_property_id) then raise exception 'Sem permissão para gerar oportunidades deste imóvel.'; end if;
  select * into v_settings from public.buyer_outreach_settings where agency_id=v_agency;
  if not found or not v_settings.enabled then return 0; end if;
  insert into public.buyer_property_opportunities(agency_id,lead_id,property_id,match_score,trigger_source,status,channel)
  select m.agency_id,m.lead_id,m.property_id,m.match_score,
    case when p_trigger_source in ('property_published','property_updated','manual','scheduled_scan') then p_trigger_source else 'manual' end,
    case when v_settings.require_explicit_consent and not coalesce(cp.automated_property_alerts_allowed,false) then 'review' when v_settings.auto_contact then 'queued' else 'review' end,
    case when 'whatsapp'=any(v_settings.channels) and coalesce(cp.whatsapp_allowed,false) then 'whatsapp' when 'email'=any(v_settings.channels) and coalesce(cp.email_allowed,false) then 'email' else null end
  from public.lead_property_match_candidates m
  left join public.lead_contact_permissions cp on cp.agency_id=m.agency_id and cp.lead_id=m.lead_id
  where m.agency_id=v_agency and m.property_id=p_property_id and m.match_score>=v_settings.min_match_score
  on conflict (agency_id,lead_id,property_id) do update set match_score=excluded.match_score,trigger_source=excluded.trigger_source,updated_at=now()
  where public.buyer_property_opportunities.status in ('queued','review','failed','skipped');
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
revoke all on function public.queue_property_buyer_matches(uuid,text) from public,anon;
grant execute on function public.queue_property_buyer_matches(uuid,text) to authenticated;

create or replace function public.queue_matches_when_property_published()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    if new.publication_state='published' and new.status='available' then perform public.queue_property_buyer_matches(new.id,'property_published'); end if;
    return new;
  end if;
  if new.publication_state='published' and new.status='available' and (old.publication_state is distinct from new.publication_state or old.status is distinct from new.status or old.price is distinct from new.price) then
    perform public.queue_property_buyer_matches(new.id,case when old.publication_state is distinct from new.publication_state then 'property_published' else 'property_updated' end);
  end if;
  return new;
end; $$;
revoke all on function public.queue_matches_when_property_published() from public,anon,authenticated;
drop trigger if exists properties_queue_buyer_matches on public.properties;
create trigger properties_queue_buyer_matches after insert or update of publication_state,status,price on public.properties for each row execute function public.queue_matches_when_property_published();

drop view if exists public.agency_buyer_opportunity_summary;
create view public.agency_buyer_opportunity_summary with (security_invoker=true) as
select agency_id,
  count(*) filter(where status in ('queued','review'))::bigint as pending,
  count(*) filter(where status='approved')::bigint as approved,
  count(*) filter(where status='sent')::bigint as sent,
  count(*) filter(where status='failed')::bigint as failed,
  round(avg(match_score) filter(where status not in ('cancelled','skipped')),1) as average_match_score
from public.buyer_property_opportunities group by agency_id;
revoke all on public.agency_buyer_opportunity_summary from public,anon;
grant select on public.agency_buyer_opportunity_summary to authenticated;
