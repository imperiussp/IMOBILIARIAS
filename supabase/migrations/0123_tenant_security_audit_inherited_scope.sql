-- Ajusta auditoria multi-tenant para tabelas que herdam o tenant por relacionamento seguro.
-- property_photos herda agency_id por properties.property_id deliberadamente.
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
  with critical(table_name, tenant_scope) as (
    values
      ('agencies'::text, 'root'::text),
      ('agency_memberships', 'direct'),
      ('agency_domains', 'direct'),
      ('agency_settings', 'direct'),
      ('properties', 'direct'),
      ('property_photos', 'property_inherited'),
      ('leads', 'direct'),
      ('lead_followups', 'direct'),
      ('lead_contact_permissions', 'direct'),
      ('brokers', 'direct'),
      ('property_documents', 'direct'),
      ('agency_documents', 'direct'),
      ('agency_assets', 'direct'),
      ('property_visit_appointments', 'direct'),
      ('buyer_property_opportunities', 'direct'),
      ('buyer_outreach_delivery_attempts', 'direct'),
      ('buyer_outreach_responses', 'direct'),
      ('device_push_tokens', 'direct'),
      ('app_notifications', 'direct'),
      ('billing_checkout_sessions', 'direct')
  ), inspected as (
    select
      c.table_name,
      c.tenant_scope,
      to_regclass('public.' || c.table_name) is not null as table_exists,
      case
        when c.tenant_scope in ('root','property_inherited') then true
        else exists(
          select 1 from information_schema.columns col
          where col.table_schema='public' and col.table_name=c.table_name and col.column_name='agency_id'
        )
      end as has_agency_id,
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
      ),0) as policy_count,
      case when c.tenant_scope='property_inherited' then exists(
        select 1
        from pg_catalog.pg_policies p
        where p.schemaname='public'
          and p.tablename=c.table_name
          and (
            coalesce(p.qual,'') ilike '%properties%'
            or coalesce(p.with_check,'') ilike '%properties%'
          )
      ) else true end as inherited_scope_policy
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
      when i.tenant_scope='property_inherited' and not i.inherited_scope_policy then 'critical'
      else 'ok'
    end as status,
    case
      when not i.table_exists then 'Tabela ainda não existe neste banco.'
      when not i.has_agency_id then 'Tabela tenant direta esperada sem coluna agency_id.'
      when not i.rls_enabled then 'RLS está desabilitado.'
      when i.policy_count=0 then 'RLS está ligado, mas nenhuma policy foi encontrada.'
      when i.tenant_scope='property_inherited' and not i.inherited_scope_policy then 'Escopo herdado esperado, mas nenhuma policy vinculada a properties foi identificada.'
      when i.tenant_scope='property_inherited' then i.policy_count || ' policy(s); tenant herdado com segurança por property_id → properties.agency_id.'
      when i.tenant_scope='root' then i.policy_count || ' policy(s); entidade raiz de tenant.'
      else i.policy_count || ' policy(s) ativa(s); agency_id e isolamento estrutural presentes.'
    end as detail
  from inspected i
  order by i.table_name;
end;
$$;

revoke all on function public.platform_tenant_security_audit() from public, anon;
grant execute on function public.platform_tenant_security_audit() to authenticated;

comment on function public.platform_tenant_security_audit() is
'Auditoria estrutural tenant-aware: aceita escopo direto por agency_id e escopo herdado explicitamente validado, como property_photos via properties.';
