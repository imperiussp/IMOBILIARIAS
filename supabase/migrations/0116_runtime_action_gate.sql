-- Regra central de execucao para acoes externas/sensiveis.
-- O modo manutencao prevalece sobre qualquer flag individual.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.platform_runtime_action_allowed(p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v public.platform_release_controls%rowtype;
  action_key text:=lower(trim(coalesce(p_action,'')));
begin
  select * into v from public.platform_release_controls where id=1;
  if not found then return false; end if;

  if v.maintenance_mode then
    return false;
  end if;

  return case action_key
    when 'catalog' then v.public_catalog_enabled
    when 'registration' then v.new_registrations_enabled
    when 'billing' then v.real_billing_enabled
    when 'messaging' then v.external_messaging_enabled
    when 'ai' then v.ai_generation_enabled
    when 'push' then v.push_notifications_enabled
    else false
  end;
end;
$$;

revoke all on function public.platform_runtime_action_allowed(text) from public,anon;
grant execute on function public.platform_runtime_action_allowed(text) to authenticated;

create or replace function public.public_catalog_runtime_enabled()
returns boolean
language sql
stable
security definer
set search_path=public
as $$ select public.platform_runtime_action_allowed('catalog') $$;
revoke all on function public.public_catalog_runtime_enabled() from public;
grant execute on function public.public_catalog_runtime_enabled() to anon,authenticated;

create or replace function public.public_registration_runtime_enabled()
returns boolean
language sql
stable
security definer
set search_path=public
as $$ select public.platform_runtime_action_allowed('registration') $$;
revoke all on function public.public_registration_runtime_enabled() from public;
grant execute on function public.public_registration_runtime_enabled() to anon,authenticated;

comment on function public.platform_runtime_action_allowed(text) is 'Autoridade central para acoes runtime. Modo manutencao bloqueia catalogo, cadastro, billing, mensageria, IA e push mesmo que a flag individual esteja ativa.';
