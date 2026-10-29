-- LENOY: cobranças com tolerância e sem excluir dados.
-- Liberação controlada: os dois recursos começam desligados até conclusão dos testes.
create table if not exists public.billing_automation_settings (
  id smallint primary key default 1 check(id=1),
  access_enforced boolean not null default false,
  emails_enabled boolean not null default false,
  enabled_from date not null default (now() at time zone 'America/Sao_Paulo')::date,
  updated_at timestamptz not null default now()
);
insert into public.billing_automation_settings(id) values(1) on conflict(id) do nothing;
alter table public.billing_automation_settings enable row level security;
revoke all on public.billing_automation_settings from anon,authenticated;

create table if not exists public.billing_notification_deliveries (
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references public.agency_subscriptions(id) on delete restrict,
 notification_type text not null check(notification_type in ('before_5d','due_today')),
 due_date date not null, destination text not null,
 status text not null check(status in ('sending','sent','failed')),
 provider_message_id text,error_message text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(subscription_id,notification_type,due_date)
);
alter table public.billing_notification_deliveries enable row level security;
revoke all on public.billing_notification_deliveries from anon,authenticated;

create or replace function public.billing_agency_public_level(p_agency_id uuid)
returns text language sql stable security definer set search_path='public' as $$
with state as (
 select a.status agency_status, s.id subscription_id, s.plan_id, s.status subscription_status,
        coalesce(s.renews_at,s.ends_at) due_at, cfg.access_enforced, cfg.enabled_from,
        coalesce(nullif(p.features->>'internal_only','')='true',false) internal_plan,
        coalesce(p.monthly_price,0) monthly_price,coalesce(p.annual_price,0) annual_price
 from public.agencies a
 cross join public.billing_automation_settings cfg
 left join lateral (
  select id,plan_id,status,renews_at,ends_at from public.agency_subscriptions
  where agency_id=a.id and status in ('trial','active','past_due')
  order by created_at desc,id desc limit 1
 ) s on true
 left join public.subscription_plans p on p.id=s.plan_id
 where a.id=p_agency_id and cfg.id=1
)
select coalesce((select case
 when agency_status not in ('active','trial','past_due') then 'suspended'
 when not access_enforced or subscription_status='trial' or internal_plan
    or subscription_id is null or due_at is null
    or (monthly_price<=0 and annual_price<=0) then 'full'
 when (due_at at time zone 'America/Sao_Paulo')::date < enabled_from then 'full'
 -- Do not suspend an account for which a renewal invoice was never generated.
 when not exists (
   select 1 from public.billing_checkout_sessions b
   where b.agency_id=p_agency_id and b.plan_id=state.plan_id
     and b.charge_type='subscription' and b.provider='infinitepay'
     and b.status in ('pending','created')
     and b.created_at >= due_at - interval '6 days'
     and b.created_at < due_at + interval '7 days'
 ) then 'full'
 when (now() at time zone 'America/Sao_Paulo')::date - (due_at at time zone 'America/Sao_Paulo')::date >= 5 then 'suspended'
 when (now() at time zone 'America/Sao_Paulo')::date - (due_at at time zone 'America/Sao_Paulo')::date >= 2 then 'limited'
 else 'full' end from state),'full');
$$;
revoke all on function public.billing_agency_public_level(uuid) from public;
grant execute on function public.billing_agency_public_level(uuid) to anon,authenticated,service_role;

create or replace function public.billing_public_visibility_for_host(p_hostname text)
returns table(visibility text,agency_name text)
language sql stable security definer set search_path='public' as $$
with matched as (
 select a.id,a.name,case when d.id is not null then 0 else 1 end rank
 from public.agencies a
 left join public.agency_domains d on d.agency_id=a.id
    and d.verified=true and lower(d.hostname)=lower(trim(p_hostname))
 where d.id is not null or (
   lower(trim(p_hostname))=lower(a.slug)||'.imoveis.lenoy.com.br'
 )
 order by rank limit 1
)
select public.billing_agency_public_level(m.id),m.name from matched m;
$$;
revoke all on function public.billing_public_visibility_for_host(text) from public;
grant execute on function public.billing_public_visibility_for_host(text) to anon,authenticated,service_role;

create or replace function public.public_catalog_for_host(p_hostname text)
returns setof public.property_catalog language sql stable security definer set search_path='public' as $$
 select pc.* from public.property_catalog pc
 join public.agency_domains d on d.agency_id=pc.agency_id
 join public.agencies a on a.id=pc.agency_id
 where lower(d.hostname)=lower(trim(p_hostname)) and d.verified=true
   and a.status in ('trial','active','past_due')
   and public.billing_agency_public_level(a.id)='full'
 order by pc.featured desc,pc.published_at desc nulls last;
$$;
create or replace function public.public_property_for_host(p_hostname text,p_property_id uuid)
returns setof public.property_catalog language sql stable security definer set search_path='public' as $$
 select pc.* from public.property_catalog pc
 join public.agency_domains d on d.agency_id=pc.agency_id
 join public.agencies a on a.id=pc.agency_id
 where pc.id=p_property_id and lower(d.hostname)=lower(trim(p_hostname))
   and d.verified=true and a.status in ('trial','active','past_due')
   and public.billing_agency_public_level(a.id)='full' limit 1;
$$;
create or replace function public.public_property_photos_for_host(p_hostname text,p_property_id uuid)
returns table(id uuid,storage_path text,thumbnail_path text,"position" integer,is_cover boolean,alt_text text)
language sql stable security definer set search_path='public' as $$
 select pp.id,pp.storage_path,pp.thumbnail_path,pp.position,pp.is_cover,pp.alt_text
 from public.property_photos pp
 join public.properties p on p.id=pp.property_id
 join public.agency_domains d on d.agency_id=p.agency_id
 join public.agencies a on a.id=p.agency_id
 where p.id=p_property_id and p.publication_state='published'
 and p.status in ('available','reserved','rented','sold')
 and lower(d.hostname)=lower(trim(p_hostname)) and d.verified=true
 and a.status in ('trial','active','past_due')
 and public.billing_agency_public_level(a.id)='full'
 order by pp.is_cover desc,pp.position asc,pp.created_at asc;
$$;
create or replace function public.public_agency_socials_for_host(p_hostname text)
returns table(instagram_url text,facebook_url text,youtube_url text,phone text,whatsapp text)
language sql stable security definer set search_path='public' as $$
 select a.instagram_url,a.facebook_url,a.youtube_url,a.phone,a.whatsapp
 from public.agency_domains d join public.agencies a on a.id=d.agency_id
 where lower(d.hostname)=lower(trim(p_hostname)) and d.verified=true
 and a.status in ('trial','active','past_due')
 and public.billing_agency_public_level(a.id)='full' limit 1;
$$;

CREATE OR REPLACE FUNCTION public.create_public_lead_for_host(p_hostname text, p_property_id uuid DEFAULT NULL::uuid, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_source text DEFAULT 'web'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hostname text := lower(trim(coalesce(p_hostname, '')));
  v_agency_id uuid;
  v_broker_id uuid;
  v_lead_id uuid;
  v_source text := lower(trim(coalesce(p_source, 'web')));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  if v_hostname = '' or length(v_hostname) > 253 then raise exception 'Hostname inválido.'; end if;
  if v_name is null or length(v_name) > 160 then raise exception 'Nome inválido.'; end if;
  if v_phone is null and v_email is null then raise exception 'Informe telefone ou e-mail.'; end if;
  if v_phone is not null and length(v_phone) > 40 then raise exception 'Telefone inválido.'; end if;
  if v_email is not null and (length(v_email) > 254 or position('@' in v_email) = 0) then raise exception 'E-mail inválido.'; end if;
  if v_message is null or length(v_message) > 4000 then raise exception 'Mensagem inválida.'; end if;
  if v_source not in ('web','web-general-contact','web-owner-property','web-property-detail','portal','email') then v_source := 'web'; end if;
  select d.agency_id into v_agency_id from public.agency_domains d join public.agencies a on a.id=d.agency_id where lower(d.hostname)=v_hostname and d.verified=true and a.status in ('trial','active','past_due') limit 1;
  if v_agency_id is null then raise exception 'Imobiliária não encontrada para este endereço.'; end if;
  if p_property_id is not null then
    select p.broker_id into v_broker_id from public.properties p where p.id=p_property_id and p.agency_id=v_agency_id and p.publication_state='published' and p.status in ('available','reserved','rented','sold') limit 1;
    if not found then raise exception 'Imóvel indisponível para este endereço.'; end if;
  end if;
  if public.billing_agency_public_level(v_agency_id) <> 'full' then raise exception 'Contato temporariamente indisponível.'; end if;
  insert into public.leads(agency_id,property_id,broker_id,name,phone,email,message,source) values(v_agency_id,p_property_id,v_broker_id,v_name,v_phone,v_email,v_message,v_source) returning id into v_lead_id;
  return v_lead_id;
end;
$function$
;

-- Direct anonymous table reads must obey the same rule as public RPCs.
alter policy "anonymous read published properties" on public.properties
to anon using (
 publication_state='published'
 and status in ('available','reserved','rented','sold')
 and public.billing_agency_public_level(agency_id)='full'
);
alter policy "anonymous read published property photos" on public.property_photos
to anon using (
 exists (select 1 from public.properties p where p.id=property_photos.property_id
 and p.publication_state='published'
 and p.status in ('available','reserved','rented','sold')
 and public.billing_agency_public_level(p.agency_id)='full')
);
-- Property catalogue is a SECURITY DEFINER view and would otherwise bypass RLS.
-- All public website reads use dedicated SECURITY DEFINER RPCs above.
revoke select on public.property_catalog from anon;
