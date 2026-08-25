create table if not exists public.agency_mailbox_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  requested_by uuid,
  local_part text not null,
  domain text not null,
  email_address text not null,
  quota_mb integer not null default 1024,
  password_cipher text,
  password_iv text,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  attempts integer not null default 0,
  last_error text,
  provider_account_ref text,
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists agency_mailbox_jobs_agency_status_idx
  on public.agency_mailbox_jobs(agency_id,status,requested_at desc);
create index if not exists agency_mailbox_jobs_queue_idx
  on public.agency_mailbox_jobs(status,requested_at)
  where status in ('queued','processing');
create unique index if not exists agency_mailbox_jobs_pending_email_unique
  on public.agency_mailbox_jobs(lower(email_address))
  where status in ('queued','processing');

alter table public.agency_mailbox_jobs enable row level security;
revoke all on table public.agency_mailbox_jobs from anon, authenticated;
grant all on table public.agency_mailbox_jobs to service_role;

create table if not exists public.mail_worker_state (
  worker_name text primary key,
  last_seen_at timestamptz not null default now(),
  last_status text not null default 'ok',
  last_message text,
  updated_at timestamptz not null default now()
);
alter table public.mail_worker_state enable row level security;
revoke all on table public.mail_worker_state from anon, authenticated;
grant all on table public.mail_worker_state to service_role;

create or replace function public.enqueue_agency_mailbox_job(
  p_agency_id uuid,
  p_local_part text,
  p_domain text,
  p_quota_mb integer,
  p_password_cipher text,
  p_password_iv text
)
returns table(job_id uuid, email_address text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local text := lower(trim(coalesce(p_local_part,'')));
  v_domain text := lower(trim(coalesce(p_domain,'')));
  v_email text;
  v_limit integer;
  v_used integer;
  v_pending integer;
  v_status text;
  v_job_id uuid;
begin
  if auth.uid() is null or not (public.can_manage_agency(p_agency_id) or public.is_platform_admin()) then
    raise exception 'Acesso negado';
  end if;
  if v_local !~ '^[a-z0-9][a-z0-9._-]{0,62}$' then raise exception 'Nome de e-mail inválido'; end if;
  if v_domain !~ '^[a-z0-9][a-z0-9.-]+[a-z0-9]$' then raise exception 'Domínio inválido'; end if;
  if coalesce(length(p_password_cipher),0) < 16 or coalesce(length(p_password_iv),0) < 8 then
    raise exception 'Senha protegida inválida';
  end if;

  v_email := v_local || '@' || v_domain;

  select s.status into v_status
  from public.agency_subscriptions s
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
    and (s.ends_at is null or s.ends_at > now())
  order by s.starts_at desc
  limit 1;
  if v_status not in ('trial','active') then raise exception 'Assinatura sem permissão para criar novas contas de e-mail'; end if;

  if v_domain <> 'imoveis.lenoy.com.br' and not exists (
    select 1 from public.agency_domains d
    where d.agency_id = p_agency_id and d.verified = true and lower(d.hostname) = v_domain
  ) then
    raise exception 'Domínio próprio não verificado para esta imobiliária';
  end if;

  if exists (
    select 1 from public.agency_mailboxes m
    where lower(m.email_address) = v_email and m.deleted_at is null and m.status <> 'deleted'
  ) or exists (
    select 1 from public.agency_mailbox_jobs j
    where lower(j.email_address) = v_email and j.status in ('queued','processing')
  ) then
    raise exception 'Este endereço de e-mail já está em uso ou em processamento';
  end if;

  v_limit := public.agency_professional_email_limit(p_agency_id);
  select count(*)::integer into v_used
  from public.agency_mailboxes
  where agency_id = p_agency_id and deleted_at is null and status <> 'deleted';
  select count(*)::integer into v_pending
  from public.agency_mailbox_jobs
  where agency_id = p_agency_id and status in ('queued','processing');
  if v_limit <= 0 or (v_used + v_pending) >= v_limit then
    raise exception 'Limite de e-mails do plano atingido';
  end if;

  insert into public.agency_mailbox_jobs(
    agency_id,requested_by,local_part,domain,email_address,quota_mb,password_cipher,password_iv,status
  ) values (
    p_agency_id,auth.uid(),v_local,v_domain,v_email,least(greatest(coalesce(p_quota_mb,1024),100),10240),p_password_cipher,p_password_iv,'queued'
  ) returning id into v_job_id;

  return query select v_job_id, v_email, 'queued'::text;
end;
$$;

create or replace function public.agency_mailbox_job_snapshot(p_agency_id uuid)
returns table(
  id uuid,
  email_address text,
  domain text,
  quota_mb integer,
  status text,
  requested_at timestamptz,
  completed_at timestamptz,
  last_error text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (public.can_manage_agency(p_agency_id) or public.is_platform_admin()) then
    raise exception 'Acesso negado';
  end if;
  return query
  select j.id,j.email_address,j.domain,j.quota_mb,j.status,j.requested_at,j.completed_at,j.last_error
  from public.agency_mailbox_jobs j
  where j.agency_id = p_agency_id
  order by j.requested_at desc
  limit 50;
end;
$$;

create or replace function public.claim_agency_mailbox_job()
returns setof public.agency_mailbox_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select j.id
    from public.agency_mailbox_jobs j
    where (
      j.status = 'queued'
      or (j.status = 'processing' and j.claimed_at < now() - interval '10 minutes' and j.attempts < 3)
    )
    order by j.requested_at
    for update skip locked
    limit 1
  )
  update public.agency_mailbox_jobs j
  set status='processing', claimed_at=now(), attempts=j.attempts+1, updated_at=now(), last_error=null
  from candidate c
  where j.id=c.id
  returning j.*;
end;
$$;

create or replace function public.complete_agency_mailbox_job(
  p_job_id uuid,
  p_success boolean,
  p_provider_account_ref text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.agency_mailbox_jobs%rowtype;
begin
  select * into v_job
  from public.agency_mailbox_jobs
  where id=p_job_id
  for update;

  if v_job.id is null then raise exception 'Solicitação não encontrada'; end if;
  if v_job.status not in ('queued','processing') then return; end if;

  if p_success then
    if not exists (
      select 1 from public.agency_mailboxes m
      where lower(m.email_address)=lower(v_job.email_address) and m.deleted_at is null and m.status <> 'deleted'
    ) then
      insert into public.agency_mailboxes(
        agency_id,local_part,domain,email_address,provider,provider_account_ref,quota_mb,status
      ) values (
        v_job.agency_id,v_job.local_part,v_job.domain,v_job.email_address,'cpanel',
        nullif(trim(coalesce(p_provider_account_ref,'')),''),v_job.quota_mb,'active'
      );
    end if;

    update public.agency_mailbox_jobs
    set status='completed', provider_account_ref=nullif(trim(coalesce(p_provider_account_ref,'')),''),
        completed_at=now(), updated_at=now(), last_error=null, password_cipher=null, password_iv=null
    where id=p_job_id;
  else
    update public.agency_mailbox_jobs
    set status='failed', completed_at=now(), updated_at=now(),
        last_error=left(coalesce(p_error,'Falha não informada'),1000), password_cipher=null, password_iv=null
    where id=p_job_id;
  end if;
end;
$$;

create or replace function public.agency_email_usage_snapshot(p_agency_id uuid)
returns table(plan_name text, email_limit integer, used_emails integer, remaining_emails integer, can_create boolean)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
  v_pending integer;
  v_plan text;
  v_status text;
begin
  if auth.uid() is not null and not (public.can_manage_agency(p_agency_id) or public.is_platform_admin()) then
    raise exception 'Acesso negado';
  end if;

  select sp.name, s.status into v_plan, v_status
  from public.agency_subscriptions s
  join public.subscription_plans sp on sp.id = s.plan_id
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
    and (s.ends_at is null or s.ends_at > now())
  order by s.starts_at desc
  limit 1;

  v_limit := public.agency_professional_email_limit(p_agency_id);
  select count(*)::integer into v_used
  from public.agency_mailboxes
  where agency_id = p_agency_id and deleted_at is null and status <> 'deleted';
  select count(*)::integer into v_pending
  from public.agency_mailbox_jobs
  where agency_id = p_agency_id and status in ('queued','processing');

  return query select
    coalesce(v_plan, 'Sem plano'),
    v_limit,
    v_used + v_pending,
    greatest(v_limit - (v_used + v_pending), 0),
    (v_status in ('trial','active') and (v_used + v_pending) < v_limit and v_limit > 0);
end;
$$;

revoke all on function public.enqueue_agency_mailbox_job(uuid,text,text,integer,text,text) from public, anon;
grant execute on function public.enqueue_agency_mailbox_job(uuid,text,text,integer,text,text) to authenticated;
revoke all on function public.agency_mailbox_job_snapshot(uuid) from public, anon;
grant execute on function public.agency_mailbox_job_snapshot(uuid) to authenticated;
revoke all on function public.claim_agency_mailbox_job() from public, anon, authenticated;
grant execute on function public.claim_agency_mailbox_job() to service_role;
revoke all on function public.complete_agency_mailbox_job(uuid,boolean,text,text) from public, anon, authenticated;
grant execute on function public.complete_agency_mailbox_job(uuid,boolean,text,text) to service_role;
