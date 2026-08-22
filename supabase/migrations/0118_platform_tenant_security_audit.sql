-- Auditoria operacional de isolamento multi-imobiliária.
-- Não altera policies existentes; apenas diagnostica tabelas críticas.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create or replace function public.platform_tenant_security_audit()
returns table(
  table_name text,
  table_exists boolean,
  has_agency_id boolean,
  rls_enabled boolean,
  policy_count integer,
  status text,
  detail text
)
language plpgsql
security definer
set search_path = public, pg_catalog, information_schema
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito à administração global.';
  end if;

  return query
  with critical(table_name, expects_agency_id) as (
    values
      ('agencies'::text, false),
      ('agency_memberships', true),
      ('agency_domains', true),
      ('agency_settings', true),
      ('properties', true),
      ('property_photos', true),
      ('leads', true),
      ('lead_followups', true),
      ('lead_contact_permissions', true),
      ('brokers', true),
      ('property_documents', true),
      ('agency_documents', true),
      ('agency_assets', true),
      ('property_visit_appointments', true),
      ('buyer_property_opportunities', true),
      ('buyer_outreach_delivery_attempts', true),
      ('buyer_outreach_responses', true),
      ('device_push_tokens', true),
      ('app_notifications', true),
      ('billing_checkout_sessions', true)
  ), inspected as (
    select
      c.table_name,
      to_regclass('public.' || c.table_name) is not null as table_exists,
      case when c.expects_agency_id then exists(
        select 1 from information_schema.columns col
        where col.table_schema='public' and col.table_name=c.table_name and col.column_name='agency_id'
      ) else true end as has_agency_id,
      coalesce((
        select cls.relrowsecurity
        from pg_catalog.pg_class cls
        join pg_catalog.pg_namespace ns on ns.oid=cls.relnamespace
        where ns.nspname='public' and cls.relname=c.table_name
      ), false) as rls_enabled,
      coalesce((
        select count(*)::integer
        from pg_catalog.pg_policies p
        where p.schemaname='public' and p.tablename=c.table_name
      ),0) as policy_count
    from critical c
  )
  select
    i.table_name,
    i.table_exists,
    i.has_agency_id,
    i.rls_enabled,
    i.policy_count,
    case
      when not i.table_exists then 'missing'
      when not i.has_agency_id then 'critical'
      when not i.rls_enabled then 'critical'
      when i.policy_count=0 then 'critical'
      else 'ok'
    end as status,
    case
      when not i.table_exists then 'Tabela ainda não existe neste banco.'
      when not i.has_agency_id then 'Tabela tenant esperada sem coluna agency_id.'
      when not i.rls_enabled then 'RLS está desabilitado.'
      when i.policy_count=0 then 'RLS está ligado, mas nenhuma policy foi encontrada.'
      else i.policy_count || ' policy(s) ativa(s); isolamento estrutural presente.'
    end as detail
  from inspected i
  order by i.table_name;
end;
$$;

revoke all on function public.platform_tenant_security_audit() from public, anon;
grant execute on function public.platform_tenant_security_audit() to authenticated;

comment on function public.platform_tenant_security_audit() is
'Diagnóstico estrutural de isolamento tenant para tabelas críticas. Restrito a platform admin; não substitui testes funcionais de RLS.';
