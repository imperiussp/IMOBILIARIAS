-- STAGING ONLY: do not run on production before review of public RPCs, storage access and exemptions.
-- Returns a non-destructive tenant-wide state to a site renderer.
-- Suspended sites must still resolve their agency so the renderer can show a neutral notice.
create or replace function public.billing_public_visibility_for_host(p_hostname text)
returns table(visibility text, agency_name text)
language sql stable security definer set search_path='public'
as $$
 with tenant as (
   select a.id, a.name, a.status
   from public.agency_domains d join public.agencies a on a.id=d.agency_id
   where d.verified and lower(d.hostname)=lower(trim(p_hostname))
   limit 1
 ), eligible as (
   select t.id,t.name,t.status,
          s.status as subscription_status,
          coalesce(s.ends_at,s.renews_at) as due_at
   from tenant t left join lateral (
     select status,ends_at,renews_at from public.agency_subscriptions s
     where s.agency_id=t.id and s.status in ('trial','active','past_due')
     order by s.created_at desc limit 1
   ) s on true
 )
 select case
   when status in ('suspended','inactive') then 'suspended'
   when subscription_status='trial' then 'full'
   when subscription_status is null or due_at is null then 'full'
   when subscription_status not in ('active','past_due') then 'suspended'
   when ((now() at time zone 'America/Sao_Paulo')::date -
        (due_at at time zone 'America/Sao_Paulo')::date)>=5 then 'suspended'
   when ((now() at time zone 'America/Sao_Paulo')::date -
        (due_at at time zone 'America/Sao_Paulo')::date)>=2 then 'limited'
   else 'full' end, name
 from eligible;
$$;
revoke all on function public.billing_public_visibility_for_host(text) from public;
grant execute on function public.billing_public_visibility_for_host(text) to anon,authenticated;

-- BEFORE DEPLOYMENT:
-- 1. Audit all public catalog, detail, photos, contact, storage and direct table policies.
-- 2. Enforce visibility server-side for EVERY public content path; UI-only masking is insufficient.
-- 3. Add explicit per-agency exemption mechanism for platform/demo/test accounts.
-- 4. Resolve stale subscription records (renews_at not null but ends_at null).
-- 5. Do not globally change agency.status, since that may disable payment recovery.
