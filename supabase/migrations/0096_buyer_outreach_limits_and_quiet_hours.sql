-- Limites comerciais, horário silencioso e validação de entrega da IA de oportunidades.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

alter table public.buyer_outreach_settings
  add column if not exists quiet_hours_enabled boolean not null default true,
  add column if not exists quiet_hours_start time not null default '20:00',
  add column if not exists quiet_hours_end time not null default '08:00',
  add column if not exists timezone text not null default 'America/Sao_Paulo';

create or replace function public.buyer_outreach_monthly_limit(p_agency_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path=public
as $$
declare v_limit integer;
begin
  if auth.uid() is not null
     and not public.is_agency_member(p_agency_id)
     and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  select nullif(sp.features ->> 'max_buyer_outreach_per_month','')::integer
    into v_limit
  from public.agency_subscriptions s
  join public.subscription_plans sp on sp.id=s.plan_id
  where s.agency_id=p_agency_id
    and s.status in ('trial','active','past_due')
    and sp.active=true
    and (s.ends_at is null or s.ends_at>now())
  order by s.starts_at desc
  limit 1;

  return v_limit;
exception when invalid_text_representation then
  return null;
end; $$;
revoke all on function public.buyer_outreach_monthly_limit(uuid) from public,anon;
grant execute on function public.buyer_outreach_monthly_limit(uuid) to authenticated;

create or replace function public.buyer_outreach_monthly_usage(p_agency_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path=public
as $$
declare v_usage integer;
begin
  if auth.uid() is not null
     and not public.is_agency_member(p_agency_id)
     and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  select count(*)::integer into v_usage
  from public.buyer_outreach_delivery_attempts a
  where a.agency_id=p_agency_id
    and a.status in ('sending','sent','delivered','read')
    and a.attempted_at >= date_trunc('month',now());
  return coalesce(v_usage,0);
end; $$;
revoke all on function public.buyer_outreach_monthly_usage(uuid) from public,anon;
grant execute on function public.buyer_outreach_monthly_usage(uuid) to authenticated;

create or replace function public.buyer_outreach_is_quiet_now(p_agency_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_settings public.buyer_outreach_settings%rowtype;
  v_local time;
begin
  if auth.uid() is not null
     and not public.is_agency_member(p_agency_id)
     and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  select * into v_settings from public.buyer_outreach_settings where agency_id=p_agency_id;
  if not found or not v_settings.quiet_hours_enabled then return false; end if;

  begin
    v_local := (now() at time zone v_settings.timezone)::time;
  exception when others then
    v_local := (now() at time zone 'America/Sao_Paulo')::time;
  end;

  if v_settings.quiet_hours_start = v_settings.quiet_hours_end then return false; end if;
  if v_settings.quiet_hours_start < v_settings.quiet_hours_end then
    return v_local >= v_settings.quiet_hours_start and v_local < v_settings.quiet_hours_end;
  end if;
  return v_local >= v_settings.quiet_hours_start or v_local < v_settings.quiet_hours_end;
end; $$;
revoke all on function public.buyer_outreach_is_quiet_now(uuid) from public,anon;
grant execute on function public.buyer_outreach_is_quiet_now(uuid) to authenticated;

create or replace function public.validate_buyer_outreach_delivery_attempt()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_op public.buyer_property_opportunities%rowtype;
  v_permission public.lead_contact_permissions%rowtype;
  v_settings public.buyer_outreach_settings%rowtype;
  v_limit integer;
  v_usage integer;
begin
  -- Serializa tentativas da mesma imobiliária para evitar ultrapassar limite mensal em concorrência.
  perform pg_advisory_xact_lock(hashtextextended(new.agency_id::text,0));

  select * into v_op from public.buyer_property_opportunities where id=new.opportunity_id;
  if not found then raise exception 'Oportunidade não encontrada.'; end if;
  if v_op.agency_id<>new.agency_id or v_op.lead_id<>new.lead_id or v_op.property_id<>new.property_id then
    raise exception 'Tentativa de entrega fora do vínculo da oportunidade.';
  end if;
  if v_op.status not in ('queued','approved') then
    raise exception 'Oportunidade não está pronta para envio.';
  end if;
  if v_op.channel is not null and v_op.channel<>new.channel then
    raise exception 'Canal diferente do canal aprovado para a oportunidade.';
  end if;
  if not public.agency_has_plan_feature(new.agency_id,'ai_buyer_outreach',false) then
    raise exception 'Plano sem IA de oportunidades.';
  end if;

  select * into v_permission from public.lead_contact_permissions
  where agency_id=new.agency_id and lead_id=new.lead_id;
  if not found or not v_permission.automated_property_alerts_allowed or v_permission.revoked_at is not null then
    raise exception 'Cliente sem consentimento ativo para alertas automáticos.';
  end if;
  if new.channel='whatsapp' and not v_permission.whatsapp_allowed then raise exception 'WhatsApp não autorizado.'; end if;
  if new.channel='email' and not v_permission.email_allowed then raise exception 'E-mail não autorizado.'; end if;
  if new.channel='sms' and not v_permission.sms_allowed then raise exception 'SMS não autorizado.'; end if;

  select * into v_settings from public.buyer_outreach_settings where agency_id=new.agency_id;
  if not found or not v_settings.enabled then raise exception 'Automação de oportunidades desativada.'; end if;

  if public.buyer_outreach_is_quiet_now(new.agency_id) then
    raise exception 'Horário silencioso ativo para a imobiliária.';
  end if;

  if exists(
    select 1 from public.buyer_outreach_delivery_attempts a
    where a.opportunity_id=new.opportunity_id
      and a.status in ('sending','sent','delivered','read')
  ) then
    raise exception 'Esta oportunidade já está em envio ou já foi enviada.';
  end if;

  if exists(
    select 1 from public.buyer_outreach_delivery_attempts a
    where a.agency_id=new.agency_id
      and a.lead_id=new.lead_id
      and a.status in ('sent','delivered','read')
      and a.attempted_at > now() - make_interval(hours=>v_settings.cooldown_hours)
  ) then
    raise exception 'Intervalo mínimo entre contatos deste comprador ainda não terminou.';
  end if;

  v_limit := public.buyer_outreach_monthly_limit(new.agency_id);
  if v_limit is not null then
    v_usage := public.buyer_outreach_monthly_usage(new.agency_id);
    if v_usage >= v_limit then raise exception 'Limite mensal de contatos automáticos atingido.'; end if;
  end if;

  new.created_by:=coalesce(new.created_by,auth.uid());
  return new;
end; $$;
revoke all on function public.validate_buyer_outreach_delivery_attempt() from public,anon,authenticated;

drop trigger if exists buyer_outreach_delivery_attempt_validate on public.buyer_outreach_delivery_attempts;
create trigger buyer_outreach_delivery_attempt_validate
before insert on public.buyer_outreach_delivery_attempts
for each row execute function public.validate_buyer_outreach_delivery_attempt();

drop view if exists public.agency_buyer_outreach_usage;
create view public.agency_buyer_outreach_usage
with (security_invoker = true)
as
select
  a.id as agency_id,
  public.buyer_outreach_monthly_usage(a.id) as used_this_month,
  public.buyer_outreach_monthly_limit(a.id) as monthly_limit,
  public.buyer_outreach_is_quiet_now(a.id) as quiet_now
from public.agencies a;
revoke all on public.agency_buyer_outreach_usage from public,anon;
grant select on public.agency_buyer_outreach_usage to authenticated;
