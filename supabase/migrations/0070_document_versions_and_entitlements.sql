-- Histórico de documentos e extensão segura dos recursos comerciais.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar em Moto Connect.

create table if not exists public.agency_document_versions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  document_id uuid not null references public.agency_documents(id) on delete cascade,
  version_number integer not null,
  title text not null,
  content text,
  status text not null check (status in ('draft','final','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(document_id, version_number)
);

create index if not exists agency_document_versions_tenant_idx
on public.agency_document_versions(agency_id, document_id, version_number desc);

alter table public.agency_document_versions enable row level security;

drop policy if exists "tenant members read document versions" on public.agency_document_versions;
create policy "tenant members read document versions" on public.agency_document_versions
for select to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin());

drop policy if exists "tenant managers manage document versions" on public.agency_document_versions;
create policy "tenant managers manage document versions" on public.agency_document_versions
for all to authenticated
using (public.can_manage_agency(agency_id) or public.is_platform_admin())
with check (public.can_manage_agency(agency_id) or public.is_platform_admin());

create or replace function public.snapshot_agency_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  if tg_op = 'UPDATE' and
     old.title is not distinct from new.title and
     old.content is not distinct from new.content and
     old.status is not distinct from new.status then
    return new;
  end if;

  select coalesce(max(v.version_number), 0) + 1 into next_version
  from public.agency_document_versions v
  where v.document_id = new.id;

  insert into public.agency_document_versions(
    agency_id, document_id, version_number, title, content, status, created_by
  ) values (
    new.agency_id, new.id, next_version, new.title, new.content, new.status, auth.uid()
  );

  return new;
end;
$$;

revoke all on function public.snapshot_agency_document() from public, anon, authenticated;

drop trigger if exists agency_documents_snapshot_version on public.agency_documents;
create trigger agency_documents_snapshot_version
after insert or update of title, content, status on public.agency_documents
for each row execute function public.snapshot_agency_document();

-- O snapshot anterior, criado em 0058, possui a mesma assinatura de argumentos
-- mas um RETURNS TABLE menor. PostgreSQL não permite alterar o tipo de retorno
-- com CREATE OR REPLACE, portanto removemos explicitamente antes de recriar.
drop function if exists public.agency_plan_feature_snapshot(uuid);

create function public.agency_plan_feature_snapshot(p_agency_id uuid)
returns table (
  plan_name text,
  broker_app boolean,
  push_notifications boolean,
  email_leads boolean,
  ai_descriptions boolean,
  custom_domain boolean,
  documents boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_agency_member(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  return query
  with plan as (
    select sp.name, sp.features
    from public.agency_subscriptions s
    join public.subscription_plans sp on sp.id = s.plan_id
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at > now())
      and sp.active = true
    order by s.starts_at desc
    limit 1
  )
  select
    coalesce((select p.name from plan p), 'Sem plano configurado')::text,
    coalesce((select lower(coalesce(p.features ->> 'broker_app','true')) in ('true','1','yes','on') from plan p), true),
    coalesce((select lower(coalesce(p.features ->> 'push_notifications','true')) in ('true','1','yes','on') from plan p), true),
    coalesce((select lower(coalesce(p.features ->> 'email_leads','true')) in ('true','1','yes','on') from plan p), true),
    coalesce((select lower(coalesce(p.features ->> 'ai_descriptions','true')) in ('true','1','yes','on') from plan p), true),
    coalesce((select lower(coalesce(p.features ->> 'custom_domain','false')) in ('true','1','yes','on') from plan p), false),
    coalesce((select lower(coalesce(p.features ->> 'documents','false')) in ('true','1','yes','on') from plan p), false);
end;
$$;

revoke all on function public.agency_plan_feature_snapshot(uuid) from public;
grant execute on function public.agency_plan_feature_snapshot(uuid) to authenticated;
