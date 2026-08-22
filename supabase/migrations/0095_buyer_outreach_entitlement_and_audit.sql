-- Entitlement, auditoria e histórico do contato automático com compradores.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create or replace function public.agency_has_plan_feature(
  p_agency_id uuid,
  p_feature_key text,
  p_default boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare v_enabled boolean;
begin
  if auth.uid() is not null
     and not public.is_agency_member(p_agency_id)
     and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  select lower(coalesce(sp.features ->> p_feature_key, case when p_default then 'true' else 'false' end)) in ('true','1','yes','on')
    into v_enabled
  from public.agency_subscriptions s
  join public.subscription_plans sp on sp.id=s.plan_id
  where s.agency_id=p_agency_id
    and s.status in ('trial','active','past_due')
    and sp.active=true
    and (s.ends_at is null or s.ends_at>now())
  order by s.starts_at desc
  limit 1;

  return coalesce(v_enabled,p_default);
end; $$;
revoke all on function public.agency_has_plan_feature(uuid,text,boolean) from public,anon;
grant execute on function public.agency_has_plan_feature(uuid,text,boolean) to authenticated;

create table if not exists public.buyer_outreach_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  opportunity_id uuid not null references public.buyer_property_opportunities(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','email','sms')),
  provider text,
  status text not null default 'prepared' check (status in ('prepared','sending','sent','delivered','read','failed','cancelled')),
  message_text text not null,
  provider_message_id text,
  provider_payload jsonb not null default '{}'::jsonb,
  error_message text,
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists buyer_outreach_attempts_agency_idx on public.buyer_outreach_delivery_attempts(agency_id,attempted_at desc);
create index if not exists buyer_outreach_attempts_opportunity_idx on public.buyer_outreach_delivery_attempts(opportunity_id,attempted_at desc);
create index if not exists buyer_outreach_attempts_lead_idx on public.buyer_outreach_delivery_attempts(agency_id,lead_id,attempted_at desc);
alter table public.buyer_outreach_delivery_attempts enable row level security;

drop policy if exists "tenant members read buyer outreach attempts" on public.buyer_outreach_delivery_attempts;
create policy "tenant members read buyer outreach attempts" on public.buyer_outreach_delivery_attempts
for select to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin());

revoke insert,update,delete on public.buyer_outreach_delivery_attempts from anon,authenticated;

create table if not exists public.lead_contact_permission_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  whatsapp_allowed boolean not null,
  email_allowed boolean not null,
  sms_allowed boolean not null,
  automated_property_alerts_allowed boolean not null,
  consent_source text,
  consent_at timestamptz,
  revoked_at timestamptz,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists lead_contact_permission_history_idx on public.lead_contact_permission_history(agency_id,lead_id,changed_at desc);
alter table public.lead_contact_permission_history enable row level security;

drop policy if exists "tenant members read consent history" on public.lead_contact_permission_history;
create policy "tenant members read consent history" on public.lead_contact_permission_history
for select to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin());
revoke insert,update,delete on public.lead_contact_permission_history from anon,authenticated;

create or replace function public.capture_lead_contact_permission_history()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT'
     or old.whatsapp_allowed is distinct from new.whatsapp_allowed
     or old.email_allowed is distinct from new.email_allowed
     or old.sms_allowed is distinct from new.sms_allowed
     or old.automated_property_alerts_allowed is distinct from new.automated_property_alerts_allowed
     or old.revoked_at is distinct from new.revoked_at then
    insert into public.lead_contact_permission_history(
      agency_id,lead_id,whatsapp_allowed,email_allowed,sms_allowed,
      automated_property_alerts_allowed,consent_source,consent_at,revoked_at,changed_by
    ) values (
      new.agency_id,new.lead_id,new.whatsapp_allowed,new.email_allowed,new.sms_allowed,
      new.automated_property_alerts_allowed,new.consent_source,new.consent_at,new.revoked_at,coalesce(new.updated_by,auth.uid())
    );
  end if;
  return new;
end; $$;
revoke all on function public.capture_lead_contact_permission_history() from public,anon,authenticated;

drop trigger if exists lead_contact_permissions_capture_history on public.lead_contact_permissions;
create trigger lead_contact_permissions_capture_history
after insert or update on public.lead_contact_permissions
for each row execute function public.capture_lead_contact_permission_history();

create or replace function public.validate_buyer_outreach_settings_entitlement()
returns trigger language plpgsql set search_path=public as $$
begin
  if (new.enabled or new.auto_contact)
     and not public.agency_has_plan_feature(new.agency_id,'ai_buyer_outreach',false) then
    raise exception 'O plano atual não inclui IA de oportunidades para compradores.';
  end if;
  new.updated_at:=now();
  new.updated_by:=coalesce(auth.uid(),new.updated_by);
  return new;
end; $$;
revoke all on function public.validate_buyer_outreach_settings_entitlement() from public,anon,authenticated;

drop trigger if exists buyer_outreach_settings_entitlement on public.buyer_outreach_settings;
create trigger buyer_outreach_settings_entitlement
before insert or update on public.buyer_outreach_settings
for each row execute function public.validate_buyer_outreach_settings_entitlement();

create or replace function public.queue_property_buyer_matches(p_property_id uuid, p_trigger_source text default 'manual')
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_agency uuid;
  v_count integer := 0;
  v_settings public.buyer_outreach_settings%rowtype;
begin
  select agency_id into v_agency from public.properties
  where id=p_property_id and publication_state='published' and status='available';
  if v_agency is null then return 0; end if;
  if not public.agency_has_plan_feature(v_agency,'ai_buyer_outreach',false) then return 0; end if;

  select * into v_settings from public.buyer_outreach_settings where agency_id=v_agency;
  if not found or not v_settings.enabled then return 0; end if;

  insert into public.buyer_property_opportunities(agency_id,lead_id,property_id,match_score,trigger_source,status,channel)
  select
    m.agency_id,m.lead_id,m.property_id,m.match_score,
    case when p_trigger_source in ('property_published','property_updated','manual','scheduled_scan') then p_trigger_source else 'manual' end,
    case
      when v_settings.require_explicit_consent and not coalesce(cp.automated_property_alerts_allowed,false) then 'review'
      when v_settings.auto_contact then 'queued'
      else 'review'
    end,
    case
      when 'whatsapp'=any(v_settings.channels) and coalesce(cp.whatsapp_allowed,false) then 'whatsapp'
      when 'email'=any(v_settings.channels) and coalesce(cp.email_allowed,false) then 'email'
      when 'sms'=any(v_settings.channels) and coalesce(cp.sms_allowed,false) then 'sms'
      else null
    end
  from public.lead_property_match_candidates m
  left join public.lead_contact_permissions cp on cp.agency_id=m.agency_id and cp.lead_id=m.lead_id
  where m.agency_id=v_agency
    and m.property_id=p_property_id
    and m.match_score>=v_settings.min_match_score
  on conflict (agency_id,lead_id,property_id) do update set
    match_score=excluded.match_score,
    trigger_source=excluded.trigger_source,
    channel=coalesce(excluded.channel,public.buyer_property_opportunities.channel),
    updated_at=now()
  where public.buyer_property_opportunities.status in ('queued','review','failed','skipped');

  get diagnostics v_count=row_count;
  return v_count;
end; $$;
revoke all on function public.queue_property_buyer_matches(uuid,text) from public,anon;
grant execute on function public.queue_property_buyer_matches(uuid,text) to authenticated;

create or replace function public.log_buyer_outreach_activity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status is distinct from new.status and new.status in ('approved','sent','failed','skipped','cancelled') then
    insert into public.lead_activity_events(agency_id,lead_id,event_type,title,detail,actor_user_id)
    values(
      new.agency_id,new.lead_id,'note_added',
      case new.status
        when 'approved' then 'Oportunidade de imóvel aprovada'
        when 'sent' then 'Oportunidade de imóvel enviada'
        when 'failed' then 'Falha ao enviar oportunidade de imóvel'
        when 'skipped' then 'Oportunidade de imóvel ignorada'
        else 'Oportunidade de imóvel cancelada'
      end,
      jsonb_build_object('opportunity_id',new.id,'property_id',new.property_id,'match_score',new.match_score,'channel',new.channel,'status',new.status),
      auth.uid()
    );
  end if;
  return new;
end; $$;
revoke all on function public.log_buyer_outreach_activity() from public,anon,authenticated;

drop trigger if exists buyer_property_opportunities_log_activity on public.buyer_property_opportunities;
create trigger buyer_property_opportunities_log_activity
after update of status on public.buyer_property_opportunities
for each row execute function public.log_buyer_outreach_activity();

create or replace view public.agency_buyer_outreach_delivery_summary as
select agency_id,
  count(*)::bigint as attempts,
  count(*) filter(where status in ('sent','delivered','read'))::bigint as sent,
  count(*) filter(where status='delivered')::bigint as delivered,
  count(*) filter(where status='read')::bigint as read,
  count(*) filter(where status='failed')::bigint as failed,
  count(*) filter(where attempted_at>=date_trunc('month',now()))::bigint as attempts_this_month
from public.buyer_outreach_delivery_attempts
group by agency_id;
revoke all on public.agency_buyer_outreach_delivery_summary from public,anon;
grant select on public.agency_buyer_outreach_delivery_summary to authenticated;
