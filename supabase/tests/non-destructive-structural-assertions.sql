-- Non-destructive structural regression checks for homologation/production readiness.
-- This file performs metadata reads only. It does not insert, update, or delete tenant data.

begin;

-- Critical tenant tables must exist with RLS enabled.
do $$
declare
  missing text;
begin
  select string_agg(expected.table_name, ', ' order by expected.table_name)
  into missing
  from (values
    ('agencies'),
    ('agency_memberships'),
    ('agency_domains'),
    ('site_settings'),
    ('properties'),
    ('property_photos'),
    ('leads'),
    ('lead_followups'),
    ('brokers'),
    ('agency_documents'),
    ('agency_assets'),
    ('property_visit_appointments'),
    ('billing_checkout_sessions')
  ) as expected(table_name)
  left join pg_class c on c.relname = expected.table_name
  left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where n.oid is null or c.relrowsecurity is not true;

  if missing is not null then
    raise exception 'Critical tables missing or without RLS: %', missing;
  end if;
end $$;

-- No role/command pair should have more than one permissive policy after consolidation.
do $$
declare
  duplicated text;
begin
  select string_agg(format('%s/%s/%s', tablename, cmd, role_name), ', ' order by tablename, cmd, role_name)
  into duplicated
  from (
    select p.tablename, p.cmd, role_name, count(*)
    from pg_policies p
    cross join lateral unnest(p.roles) as role_name
    where p.schemaname = 'public'
      and p.permissive = 'PERMISSIVE'
    group by p.tablename, p.cmd, role_name
    having count(*) > 1
  ) d;

  if duplicated is not null then
    raise exception 'Multiple permissive policies detected: %', duplicated;
  end if;
end $$;

-- Sensitive SECURITY DEFINER helpers must not be executable by anonymous clients.
do $$
begin
  if has_function_privilege('anon', 'public.normalize_property_photo_cover(uuid)', 'EXECUTE') then
    raise exception 'anon can execute normalize_property_photo_cover(uuid)';
  end if;

  if to_regprocedure('public.claim_initial_admin()') is not null
     and (has_function_privilege('anon', 'public.claim_initial_admin()', 'EXECUTE')
       or has_function_privilege('authenticated', 'public.claim_initial_admin()', 'EXECUTE')) then
    raise exception 'legacy claim_initial_admin() is executable by client roles';
  end if;

  if to_regprocedure('public.initial_admin_available()') is not null
     and (has_function_privilege('anon', 'public.initial_admin_available()', 'EXECUTE')
       or has_function_privilege('authenticated', 'public.initial_admin_available()', 'EXECUTE')) then
    raise exception 'legacy initial_admin_available() is executable by client roles';
  end if;
end $$;

-- Regression check for the historical broker-monthly-goal tenant-scope tautology.
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'broker_monthly_goals'
    and (coalesce(qual, '') ilike '%b.agency_id = b.agency_id%'
      or coalesce(with_check, '') ilike '%b.agency_id = b.agency_id%');

  if bad_count > 0 then
    raise exception 'broker_monthly_goals tenant-scope tautology reintroduced';
  end if;
end $$;

-- Internal platform tables remain RLS-protected.
do $$
declare
  bad text;
begin
  select string_agg(v.table_name, ', ' order by v.table_name)
  into bad
  from (values
    ('inbound_email_events'),
    ('platform_maintenance_auth'),
    ('platform_owner_bootstrap_tokens')
  ) v(table_name)
  join pg_class c on c.relname = v.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relrowsecurity is not true;

  if bad is not null then
    raise exception 'Internal tables without RLS: %', bad;
  end if;
end $$;

-- Platform subdomains created as verified must be normalized to verified status.
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.agency_domains'::regclass
      and tgname = 'agency_domains_platform_insert_state'
      and tgenabled <> 'D'
  ) then
    raise exception 'agency_domains_platform_insert_state trigger is missing or disabled';
  end if;

  if exists (
    select 1 from public.agency_domains
    where kind = 'platform'
      and verified = true
      and verification_status is distinct from 'verified'
  ) then
    raise exception 'Verified platform domain has inconsistent verification_status';
  end if;
end $$;

rollback;
