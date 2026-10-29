-- LENOY / Cobrança: migração preparatória, NÃO executar sem auditoria final.
-- Valor e link devem vir do MESMO checkout ativo, nunca do preço de tabela.
-- Sem checkout válido, não enviar; a geração de cobrança permanece pendente.
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
 left join lateral (select bc.billing_email from public.billing_customers bc where bc.agency_id=s.agency_id and bc.provider='infinitepay' order by bc.updated_at desc limit 1) c on true
 left join public.agency_billing_profiles bp on bp.agency_id=s.agency_id
 where s.status in ('active','past_due') and coalesce(s.ends_at,s.renews_at) is not null
   and a.status in ('active','past_due')
   and not exists (select 1 from public.agency_subscriptions newer where newer.agency_id=s.agency_id and (newer.created_at, newer.id)>(s.created_at,s.id) and newer.status in ('trial','active','past_due'))
 )
 select t.subscription_id,
 case when t.due_date=p_local_date+5 then 'before_5d' else 'due_today' end,
 t.due_date,t.billing_email,t.agency_name,t.plan_name,coalesce(t.billing_cycle,'monthly'),
 b.amount,
 b.checkout_url
 from targets t
 join lateral (select cs.amount, cs.checkout_url from public.billing_checkout_sessions cs
   where cs.agency_id=t.agency_id and cs.plan_id=t.plan_id
     and cs.charge_type='subscription' and cs.status='pending'
     and cs.expires_at>now() and cs.amount>0 and cs.checkout_url like 'https://%'
   order by cs.created_at desc limit 1) b on true
 where t.due_date in (p_local_date,p_local_date+5) and t.billing_email like '%@%';
$$;
revoke all on function public.billing_due_notification_candidates(date) from public,anon,authenticated;
grant execute on function public.billing_due_notification_candidates(date) to service_role;
