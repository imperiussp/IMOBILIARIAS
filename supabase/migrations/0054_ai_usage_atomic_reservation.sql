-- Reserva atômica de uso da IA por imobiliária.
-- Impede duas gerações simultâneas de ultrapassarem o limite mensal do plano.

create or replace function public.reserve_ai_description_usage(
  p_agency_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  max_allowed integer;
  used_count bigint;
  event_id uuid;
begin
  if not public.is_agency_member(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_agency_id::text || ':ai-description'));

  select p.max_ai_descriptions
  into max_allowed
  from public.agency_subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
    and p.active = true
  order by s.starts_at desc
  limit 1;

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
$$;

revoke all on function public.reserve_ai_description_usage(uuid, jsonb) from public;
grant execute on function public.reserve_ai_description_usage(uuid, jsonb) to authenticated;

create or replace function public.cancel_ai_description_usage(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ai_usage_events
  where id = p_event_id
    and user_id = auth.uid()
    and kind = 'property_description'
    and created_at > now() - interval '10 minutes';
end;
$$;

revoke all on function public.cancel_ai_description_usage(uuid) from public;
grant execute on function public.cancel_ai_description_usage(uuid) to authenticated;
