-- Checkpoints persistentes da implantação externa.
-- Complementa as evidências funcionais: aqui registramos infraestrutura real.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create table if not exists public.platform_deployment_checkpoints (
  checkpoint_key text primary key,
  label text not null,
  category text not null check (category in ('database','backend','web','dns','operations','integration')),
  required_for_network boolean not null default false,
  required_for_production boolean not null default false,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.platform_deployment_checkpoints(checkpoint_key,label,category,required_for_network,required_for_production)
values
  ('supabase_exclusive','Supabase exclusivo do IMOBILIARIAS confirmado','database',true,true),
  ('migrations_applied','Todas as migrations aplicadas no ambiente alvo','database',true,true),
  ('supabase_identity_checked','RPC project_identity() retorna IMOBILIARIAS','database',true,true),
  ('edge_functions_deployed','Edge Functions necessárias implantadas','backend',true,true),
  ('web_deployed','Aplicação web publicada','web',true,true),
  ('platform_domain_pointed','imoveis.lenoy.com.br apontado para o host correto','dns',true,true),
  ('tls_valid','HTTPS/TLS válido no domínio principal','dns',true,true),
  ('maintenance_cron_configured','Cron da platform-maintenance configurado','operations',true,true),
  ('maintenance_success_verified','Execução real da manutenção concluída com success=true','operations',true,true),
  ('seo_blocked_homologation','Indexação permanece bloqueada durante homologação','web',true,false),
  ('backup_strategy_verified','Backup e procedimento de recuperação verificados','operations',false,true),
  ('production_observability_checked','Saúde da plataforma revisada sem bloqueios críticos','operations',false,true),
  ('billing_provider_validated','InfinitePay validado em operação controlada','integration',false,false),
  ('messaging_provider_validated','Meta/Resend validados com contatos autorizados','integration',false,false),
  ('ai_provider_validated','Provedor de IA validado com dados de teste','integration',false,false),
  ('push_provider_validated','Push validado em dispositivo controlado','integration',false,false)
on conflict (checkpoint_key) do update set
  label=excluded.label,
  category=excluded.category,
  required_for_network=excluded.required_for_network,
  required_for_production=excluded.required_for_production;

alter table public.platform_deployment_checkpoints enable row level security;

drop policy if exists "platform admins manage deployment checkpoints" on public.platform_deployment_checkpoints;
create policy "platform admins manage deployment checkpoints"
on public.platform_deployment_checkpoints
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.touch_platform_deployment_checkpoint()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.updated_at:=now();
  if new.completed and not coalesce(old.completed,false) then
    new.completed_at:=now();
    new.completed_by:=auth.uid();
  elsif not new.completed then
    new.completed_at:=null;
    new.completed_by:=null;
  end if;
  return new;
end;
$$;
revoke all on function public.touch_platform_deployment_checkpoint() from public,anon,authenticated;

drop trigger if exists platform_deployment_checkpoint_touch on public.platform_deployment_checkpoints;
create trigger platform_deployment_checkpoint_touch
before update on public.platform_deployment_checkpoints
for each row execute function public.touch_platform_deployment_checkpoint();

create or replace view public.platform_deployment_readiness_summary
with (security_invoker=true)
as
select
  count(*) filter(where required_for_network)::int as network_total,
  count(*) filter(where required_for_network and completed)::int as network_done,
  count(*) filter(where required_for_network and not completed)::int as network_blockers,
  count(*) filter(where required_for_production)::int as production_total,
  count(*) filter(where required_for_production and completed)::int as production_done,
  count(*) filter(where required_for_production and not completed)::int as production_blockers
from public.platform_deployment_checkpoints;

revoke all on public.platform_deployment_readiness_summary from public,anon;
grant select on public.platform_deployment_readiness_summary to authenticated;

comment on table public.platform_deployment_checkpoints is 'Checklist persistente de infraestrutura/deploy; não substitui evidências funcionais de homologação.';
