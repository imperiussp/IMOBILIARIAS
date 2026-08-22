-- Preserva eventos de provedor que nunca conseguiram ser correlacionados.
-- Em vez de apagar dados de auditoria, eventos pendentes por mais de 7 dias
-- podem ser marcados como abandonados pela rotina de manutenção.

alter table public.outreach_provider_event_inbox
  add column if not exists abandoned_at timestamptz;

create index if not exists outreach_provider_event_inbox_abandoned_idx
  on public.outreach_provider_event_inbox (abandoned_at desc)
  where abandoned_at is not null;

create or replace function public.abandon_stale_outreach_provider_events(
  p_age_days integer default 7
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_age_days integer := greatest(1, least(coalesce(p_age_days, 7), 90));
  v_count integer := 0;
begin
  update public.outreach_provider_event_inbox
     set abandoned_at = now(),
         last_error = coalesce(last_error, 'Evento não correlacionado dentro da janela operacional; preservado para auditoria.')
   where processed_at is null
     and abandoned_at is null
     and received_at < now() - make_interval(days => v_age_days);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.abandon_stale_outreach_provider_events(integer) from public;
revoke all on function public.abandon_stale_outreach_provider_events(integer) from anon;
revoke all on function public.abandon_stale_outreach_provider_events(integer) from authenticated;
grant execute on function public.abandon_stale_outreach_provider_events(integer) to service_role;
