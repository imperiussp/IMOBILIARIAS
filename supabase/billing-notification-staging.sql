-- LENOY / Cobrança: migração preparatória, NÃO executar sem auditoria final.
create table if not exists public.billing_notification_deliveries (
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references public.agency_subscriptions(id) on delete restrict,
 notification_type text not null check (notification_type in ('before_5d','due_today')),
 due_date date not null,
 destination text not null,
 status text not null check (status in ('sending','sent','failed')),
 provider_message_id text,
 error_message text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(subscription_id,notification_type,due_date)
);
alter table public.billing_notification_deliveries enable row level security;
revoke all on public.billing_notification_deliveries from anon,authenticated;
create or replace function public.billing_due_notification_candidates(p_local_date date)
returns table(subscription_id uuid,notification_type text,due_date date,billing_email text,agency_name text,plan_name text,billing_cycle text,amount numeric,checkout_url text)
language sql stable security invoker set search_path=public as $$
 with targets as (
 select s.id as subscription_id,s.agency_id,s.plan_id,s.billing_cycle,
        (coalesce(s.ends_at,s.renews_at) at time zone 'America/Sao_Paulo')::date as due_date,
        a.name as agency_name,coalesce(nullif(trim(c.billing_email),''),nullif(trim(a.email),'')) as billing_email,
        p.name as plan_name,p.monthly_price,p.annual_price,bp.monthly_price_override
 from public.agency_subscriptions s
 join public.agencies a on a.id=s.agency_id
 join public.subscription_plans p on p.id=s.plan_id
 left join public.billing_customers c on c.agency_id=s.agency_id and c.provider='infinitepay'
 left join public.agency_billing_profiles bp on bp.agency_id=s.agency_id
 where s.status in ('active','past_due') and coalesce(s.ends_at,s.renews_at) is not null
   and a.status in ('active','past_due')
 )
 select t.subscription_id,
 case when t.due_date=p_local_date+5 then 'before_5d' else 'due_today' end,
 t.due_date,t.billing_email,t.agency_name,t.plan_name,coalesce(t.billing_cycle,'monthly'),
 case when t.billing_cycle='annual' then t.annual_price else coalesce(t.monthly_price_override,t.monthly_price) end,
 (select b.checkout_url from public.billing_checkout_sessions b
   where b.agency_id=t.agency_id and b.plan_id=t.plan_id and b.status='pending'
     and b.expires_at>now() and b.checkout_url like 'https://%'
   order by b.created_at desc limit 1)
 from targets t
 where t.due_date in (p_local_date,p_local_date+5) and t.billing_email like '%@%';
$$;
revoke all on function public.billing_due_notification_candidates(date) from public,anon,authenticated;
grant execute on function public.billing_due_notification_candidates(date) to service_role;
