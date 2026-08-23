-- Production hardening: plan-gated capabilities must fail closed when no valid subscription exists.

create or replace function public.agency_can_add_member(p_agency_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  with current_plan as (
    select p.max_users
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id=s.plan_id
    where s.agency_id=p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at>now())
      and p.active=true
    order by s.starts_at desc
    limit 1
  )
  select coalesce((
    select cp.max_users is null
      or (select count(*) from public.agency_memberships am where am.agency_id=p_agency_id and am.active=true) < cp.max_users
    from current_plan cp
  ), false)
$function$;

create or replace function public.agency_can_use_ai_description(p_agency_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  with current_plan as (
    select p.max_ai_descriptions,p.features
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id=s.plan_id
    where s.agency_id=p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at>now())
      and p.active=true
    order by s.starts_at desc
    limit 1
  )
  select coalesce((
    select lower(coalesce(cp.features->>'ai_descriptions','true')) in ('true','1','yes','on')
      and (cp.max_ai_descriptions is null or (
        select count(*) from public.ai_usage_events au
        where au.agency_id=p_agency_id
          and au.kind='property_description'
          and au.created_at>=date_trunc('month',now())
      ) < cp.max_ai_descriptions)
    from current_plan cp
  ), false)
$function$;

create or replace function public.agency_has_plan_feature(p_agency_id uuid, p_feature_key text, p_default boolean default false)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_enabled boolean;
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

  return coalesce(v_enabled,false);
end;
$function$;

create or replace function public.agency_plan_feature_snapshot(p_agency_id uuid)
returns table(plan_name text, broker_app boolean, push_notifications boolean, email_leads boolean, ai_descriptions boolean, custom_domain boolean, documents boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.is_agency_member(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  return query
  with plan as (
    select sp.name,sp.features
    from public.agency_subscriptions s
    join public.subscription_plans sp on sp.id=s.plan_id
    where s.agency_id=p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at>now())
      and sp.active=true
    order by s.starts_at desc
    limit 1
  )
  select
    coalesce((select p.name from plan p),'Sem plano válido')::text,
    coalesce((select lower(coalesce(p.features->>'broker_app','true')) in ('true','1','yes','on') from plan p),false),
    coalesce((select lower(coalesce(p.features->>'push_notifications','true')) in ('true','1','yes','on') from plan p),false),
    coalesce((select lower(coalesce(p.features->>'email_leads','true')) in ('true','1','yes','on') from plan p),false),
    coalesce((select lower(coalesce(p.features->>'ai_descriptions','true')) in ('true','1','yes','on') from plan p),false),
    coalesce((select lower(coalesce(p.features->>'custom_domain','false')) in ('true','1','yes','on') from plan p),false),
    coalesce((select lower(coalesce(p.features->>'documents','false')) in ('true','1','yes','on') from plan p),false);
end;
$function$;

create or replace function public.reserve_ai_description_usage(p_agency_id uuid, p_metadata jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  max_allowed integer;
  used_count bigint;
  event_id uuid;
  feature_enabled boolean;
  has_current_plan boolean := false;
begin
  if not public.is_agency_member(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_agency_id::text || ':ai-description'));

  select
    p.max_ai_descriptions,
    lower(coalesce(p.features ->> 'ai_descriptions', 'true')) in ('true','1','yes','on'),
    true
  into max_allowed, feature_enabled, has_current_plan
  from public.agency_subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
    and (s.ends_at is null or s.ends_at>now())
    and p.active = true
  order by s.starts_at desc
  limit 1;

  if not has_current_plan then
    raise exception 'Assinatura válida necessária para usar IA.';
  end if;

  if not feature_enabled then
    raise exception 'A geração de descrições com IA não está incluída no plano atual.';
  end if;

  select count(*) into used_count
  from public.ai_usage_events au
  where au.agency_id = p_agency_id
    and au.kind = 'property_description'
    and au.created_at >= date_trunc('month', now());

  if max_allowed is not null and used_count >= max_allowed then
    raise exception 'Limite mensal de descrições com IA atingido.';
  end if;

  insert into public.ai_usage_events (agency_id, user_id, kind, metadata)
  values (p_agency_id, auth.uid(), 'property_description', coalesce(p_metadata, '{}'::jsonb))
  returning id into event_id;

  return event_id;
end;
$function$;
