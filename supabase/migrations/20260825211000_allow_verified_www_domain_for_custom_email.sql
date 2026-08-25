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
set search_path to 'public'
as $function$
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

  if v_local !~ '^[a-z0-9][a-z0-9._-]{0,62}$' then
    raise exception 'Nome de e-mail inválido';
  end if;
  if v_domain !~ '^[a-z0-9][a-z0-9.-]+[a-z0-9]$' then
    raise exception 'Domínio inválido';
  end if;
  if coalesce(length(p_password_cipher),0) < 16 or coalesce(length(p_password_iv),0) < 8 then
    raise exception 'Senha protegida inválida';
  end if;

  if v_domain <> 'imoveis.lenoy.com.br' and v_domain like '%.imoveis.lenoy.com.br' then
    raise exception 'Use apenas imoveis.lenoy.com.br para e-mails LENOY';
  end if;

  v_email := v_local || '@' || v_domain;

  select s.status
    into v_status
  from public.agency_subscriptions s
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
    and (s.ends_at is null or s.ends_at > now())
  order by s.starts_at desc
  limit 1;

  if v_status not in ('trial','active') then
    raise exception 'Assinatura sem permissão para criar novas contas de e-mail';
  end if;

  if v_domain <> 'imoveis.lenoy.com.br' and not exists (
    select 1
    from public.agency_domains d
    where d.agency_id = p_agency_id
      and d.verified = true
      and d.kind = 'custom'
      and (
        lower(d.hostname) = v_domain
        or lower(d.hostname) = 'www.' || v_domain
      )
  ) then
    raise exception 'Domínio próprio não verificado para esta imobiliária';
  end if;

  if exists (
    select 1
    from public.agency_mailboxes m
    where lower(m.email_address) = v_email
      and m.deleted_at is null
      and m.status <> 'deleted'
  ) or exists (
    select 1
    from public.agency_mailbox_jobs j
    where lower(j.email_address) = v_email
      and j.status in ('queued','processing')
  ) then
    raise exception 'Este endereço de e-mail já está em uso ou em processamento';
  end if;

  v_limit := public.agency_professional_email_limit(p_agency_id);

  select count(*)::integer
    into v_used
  from public.agency_mailboxes m
  where m.agency_id = p_agency_id
    and m.deleted_at is null
    and m.status <> 'deleted';

  select count(*)::integer
    into v_pending
  from public.agency_mailbox_jobs j
  where j.agency_id = p_agency_id
    and j.status in ('queued','processing');

  if v_limit <= 0 or (v_used + v_pending) >= v_limit then
    raise exception 'Limite de e-mails do plano atingido';
  end if;

  insert into public.agency_mailbox_jobs(
    agency_id,
    requested_by,
    local_part,
    domain,
    email_address,
    quota_mb,
    password_cipher,
    password_iv,
    status
  ) values (
    p_agency_id,
    auth.uid(),
    v_local,
    v_domain,
    v_email,
    least(greatest(coalesce(p_quota_mb,1024),100),10240),
    p_password_cipher,
    p_password_iv,
    'queued'
  )
  returning agency_mailbox_jobs.id into v_job_id;

  return query select v_job_id, v_email, 'queued'::text;
end;
$function$;
