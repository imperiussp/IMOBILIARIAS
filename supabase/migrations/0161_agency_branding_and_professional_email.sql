-- Identidade visual compartilhada entre site e aplicativo + estrutura de e-mails profissionais opcionais.

alter table public.agencies
  add column if not exists background_color text,
  add column if not exists text_color text,
  add column if not exists theme_preset text not null default 'classic',
  add column if not exists button_style text not null default 'rounded';

do $$ begin
  alter table public.agencies add constraint agencies_background_color_hex
    check (background_color is null or background_color ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agencies add constraint agencies_text_color_hex
    check (text_color is null or text_color ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agencies add constraint agencies_theme_preset_valid
    check (theme_preset in ('classic','modern','elegant','minimal'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.agencies add constraint agencies_button_style_valid
    check (button_style in ('rounded','square','pill'));
exception when duplicate_object then null; end $$;

-- Logo público da imobiliária. O primeiro diretório do objeto é sempre o agency_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agency-branding', 'agency-branding', true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tenant branding insert" on storage.objects;
create policy "tenant branding insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'agency-branding'
  and public.storage_agency_id(name) is not null
  and (public.can_manage_agency(public.storage_agency_id(name)) or public.is_platform_admin())
);

drop policy if exists "tenant branding update" on storage.objects;
create policy "tenant branding update" on storage.objects
for update to authenticated
using (
  bucket_id = 'agency-branding'
  and public.storage_agency_id(name) is not null
  and (public.can_manage_agency(public.storage_agency_id(name)) or public.is_platform_admin())
)
with check (
  bucket_id = 'agency-branding'
  and public.storage_agency_id(name) is not null
  and (public.can_manage_agency(public.storage_agency_id(name)) or public.is_platform_admin())
);

drop policy if exists "tenant branding delete" on storage.objects;
create policy "tenant branding delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'agency-branding'
  and public.storage_agency_id(name) is not null
  and (public.can_manage_agency(public.storage_agency_id(name)) or public.is_platform_admin())
);

create or replace function public.resolve_agency_theme(p_agency_id uuid)
returns table(
  primary_color text,
  secondary_color text,
  background_color text,
  text_color text,
  theme_preset text,
  button_style text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(a.primary_color, '#17202a'),
    coalesce(a.secondary_color, '#d6ac58'),
    coalesce(a.background_color, '#f7f8fa'),
    coalesce(a.text_color, '#18212b'),
    coalesce(a.theme_preset, 'classic'),
    coalesce(a.button_style, 'rounded')
  from public.agencies a
  where a.id = p_agency_id
    and a.status in ('trial','active','past_due')
  limit 1
$$;

revoke all on function public.resolve_agency_theme(uuid) from public;
grant execute on function public.resolve_agency_theme(uuid) to anon, authenticated;

-- Nenhuma caixa é criada automaticamente. A tabela registra somente caixas que o cliente solicitou.
create table if not exists public.agency_mailboxes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  local_part text not null,
  domain text not null,
  email_address text not null,
  provider text not null default 'cpanel',
  provider_account_ref text,
  quota_mb integer not null default 1024 check (quota_mb between 100 and 10240),
  status text not null default 'active' check (status in ('pending','active','suspended','error','deleted')),
  suspended_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (local_part ~ '^[a-z0-9][a-z0-9._-]{0,62}$'),
  check (domain ~ '^[a-z0-9][a-z0-9.-]+[a-z0-9]$')
);

create unique index if not exists agency_mailboxes_email_unique
  on public.agency_mailboxes (lower(email_address))
  where deleted_at is null;
create index if not exists agency_mailboxes_agency_status_idx
  on public.agency_mailboxes (agency_id, status, created_at desc);

alter table public.agency_mailboxes enable row level security;
revoke all on table public.agency_mailboxes from anon, authenticated;
grant select on table public.agency_mailboxes to authenticated;

drop policy if exists "agency managers read mailboxes" on public.agency_mailboxes;
create policy "agency managers read mailboxes" on public.agency_mailboxes
for select to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin());

create or replace function public.agency_professional_email_limit(p_agency_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text;
  v_name text;
  v_features jsonb;
  v_limit integer;
begin
  select sp.code, sp.name, sp.features
    into v_code, v_name, v_features
  from public.agency_subscriptions s
  join public.subscription_plans sp on sp.id = s.plan_id
  where s.agency_id = p_agency_id
    and s.status in ('trial','active','past_due')
    and (s.ends_at is null or s.ends_at > now())
    and sp.active = true
  order by s.starts_at desc
  limit 1;

  if v_code is null then return 0; end if;

  begin
    v_limit := nullif(v_features->>'professional_email_limit','')::integer;
  exception when others then
    v_limit := null;
  end;
  if v_limit is not null then return greatest(v_limit, 0); end if;

  if lower(coalesce(v_code,'')) like '%start%' or lower(coalesce(v_name,'')) = 'start' then return 1; end if;
  if lower(coalesce(v_code,'')) like '%business%' or lower(coalesce(v_name,'')) = 'business' then return 5; end if;
  if lower(coalesce(v_code,'')) like '%prime%' or lower(coalesce(v_name,'')) = 'prime' then return 10; end if;
  if lower(coalesce(v_code,'')) like '%pro%' or lower(coalesce(v_name,'')) = 'pro' then return 3; end if;
  if lower(coalesce(v_code,'')) like '%homolog%' then return 10; end if;
  return 0;
end;
$$;

create or replace function public.agency_email_usage_snapshot(p_agency_id uuid)
returns table(
  plan_name text,
  email_limit integer,
  used_emails integer,
  remaining_emails integer,
  can_create boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
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

  return query select
    coalesce(v_plan, 'Sem plano'),
    v_limit,
    v_used,
    greatest(v_limit - v_used, 0),
    (v_status in ('trial','active') and v_used < v_limit and v_limit > 0);
end;
$$;

create or replace function public.register_agency_mailbox(
  p_agency_id uuid,
  p_local_part text,
  p_domain text,
  p_provider_account_ref text default null,
  p_quota_mb integer default 1024
)
returns public.agency_mailboxes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local text := lower(trim(coalesce(p_local_part,'')));
  v_domain text := lower(trim(coalesce(p_domain,'')));
  v_limit integer;
  v_used integer;
  v_status text;
  v_row public.agency_mailboxes%rowtype;
begin
  if auth.uid() is null or not (public.can_manage_agency(p_agency_id) or public.is_platform_admin()) then
    raise exception 'Acesso negado';
  end if;
  if v_local !~ '^[a-z0-9][a-z0-9._-]{0,62}$' then raise exception 'Nome de e-mail inválido'; end if;
  if v_domain !~ '^[a-z0-9][a-z0-9.-]+[a-z0-9]$' then raise exception 'Domínio inválido'; end if;

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

  v_limit := public.agency_professional_email_limit(p_agency_id);
  select count(*)::integer into v_used from public.agency_mailboxes
  where agency_id = p_agency_id and deleted_at is null and status <> 'deleted';
  if v_limit <= 0 or v_used >= v_limit then raise exception 'Limite de e-mails do plano atingido'; end if;

  insert into public.agency_mailboxes(agency_id,local_part,domain,email_address,provider,provider_account_ref,quota_mb,status)
  values (p_agency_id,v_local,v_domain,v_local||'@'||v_domain,'cpanel',nullif(trim(coalesce(p_provider_account_ref,'')),''),least(greatest(coalesce(p_quota_mb,1024),100),10240),'active')
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.agency_professional_email_limit(uuid) from public;
revoke all on function public.agency_email_usage_snapshot(uuid) from public;
revoke all on function public.register_agency_mailbox(uuid,text,text,text,integer) from public;
grant execute on function public.agency_professional_email_limit(uuid) to authenticated;
grant execute on function public.agency_email_usage_snapshot(uuid) to authenticated;
grant execute on function public.register_agency_mailbox(uuid,text,text,text,integer) to authenticated;

-- Plano de homologação acompanha a maior capacidade enquanto os planos comerciais ainda não foram semeados no banco.
update public.subscription_plans
set features = coalesce(features,'{}'::jsonb) || jsonb_build_object('professional_email_limit',10,'theme_customization',true),
    updated_at = now()
where lower(code) like '%homolog%';
