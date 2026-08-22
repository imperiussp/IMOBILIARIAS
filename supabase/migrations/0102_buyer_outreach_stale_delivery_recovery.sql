-- Recuperação conservadora de tentativas de mensageria presas em "sending".
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar em outro projeto.
--
-- A rotina NÃO reenvia mensagens. Ela apenas transforma tentativas antigas em
-- falha controlada e devolve a oportunidade para tratamento humano.

create or replace function public.recover_stale_buyer_outreach_attempts(
  p_timeout_minutes integer default 20
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_timeout integer := greatest(5, least(coalesce(p_timeout_minutes,20), 1440));
  v_count integer := 0;
begin
  with stale as (
    select a.id, a.opportunity_id, a.agency_id
    from public.buyer_outreach_delivery_attempts a
    where a.status='sending'
      and a.attempted_at < now() - make_interval(mins => v_timeout)
    for update skip locked
  ), updated_attempts as (
    update public.buyer_outreach_delivery_attempts a
       set status='failed',
           error_message='Tempo limite de entrega excedido. A mensagem não será reenviada automaticamente; revisar antes de nova tentativa.',
           provider_payload=coalesce(a.provider_payload,'{}'::jsonb) || jsonb_build_object(
             'recovery','stale_delivery_timeout',
             'recovered_at',now(),
             'timeout_minutes',v_timeout
           )
      from stale s
     where a.id=s.id
     returning a.id,a.opportunity_id,a.agency_id
  ), updated_opportunities as (
    update public.buyer_property_opportunities o
       set status='failed',
           last_error='Tentativa de entrega excedeu o tempo limite e requer revisão manual.',
           updated_at=now()
      from updated_attempts a
     where o.id=a.opportunity_id
       and o.agency_id=a.agency_id
       and o.status not in ('sent','cancelled')
     returning o.id
  )
  select count(*)::integer into v_count from updated_attempts;

  return v_count;
end;
$$;

revoke all on function public.recover_stale_buyer_outreach_attempts(integer) from public,anon,authenticated;
