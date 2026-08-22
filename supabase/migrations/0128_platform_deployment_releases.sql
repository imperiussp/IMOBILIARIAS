-- Histórico explícito das versões implantadas.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create table if not exists public.platform_deployment_releases (
  id uuid primary key default gen_random_uuid(),
  environment_mode text not null check(environment_mode in ('development','homologation','production')),
  commit_sha text not null check(length(commit_sha)>=7),
  release_label text,
  deployed_url text,
  smoke_status text not null default 'pending' check(smoke_status in ('pending','passed','failed')),
  smoke_checked_at timestamptz,
  rollback_candidate boolean not null default false,
  active boolean not null default false,
  notes text,
  deployed_by uuid references auth.users(id) on delete set null,
  deployed_at timestamptz not null default now()
);

create index if not exists platform_deployment_releases_environment_idx
on public.platform_deployment_releases(environment_mode,deployed_at desc);

create unique index if not exists platform_deployment_releases_one_active_per_environment_idx
on public.platform_deployment_releases(environment_mode)
where active=true;

alter table public.platform_deployment_releases enable row level security;

drop policy if exists "platform admins manage deployment releases" on public.platform_deployment_releases;
create policy "platform admins manage deployment releases"
on public.platform_deployment_releases
for all to authenticated
using(public.is_platform_admin())
with check(public.is_platform_admin());

create or replace function public.normalize_platform_deployment_release()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.commit_sha:=lower(trim(new.commit_sha));
  if new.deployed_by is null then new.deployed_by:=auth.uid(); end if;
  if new.smoke_status in ('passed','failed') and new.smoke_checked_at is null then new.smoke_checked_at:=now(); end if;
  if new.smoke_status='pending' then new.smoke_checked_at:=null; end if;
  if new.active then
    update public.platform_deployment_releases
      set active=false
    where environment_mode=new.environment_mode
      and id is distinct from new.id
      and active=true;
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_platform_deployment_release() from public,anon,authenticated;

drop trigger if exists platform_deployment_release_normalize on public.platform_deployment_releases;
create trigger platform_deployment_release_normalize
before insert or update on public.platform_deployment_releases
for each row execute function public.normalize_platform_deployment_release();

create or replace view public.platform_current_deployment
with (security_invoker=true)
as
select distinct on(environment_mode)
  environment_mode,commit_sha,release_label,deployed_url,smoke_status,smoke_checked_at,rollback_candidate,active,notes,deployed_at
from public.platform_deployment_releases
order by environment_mode,active desc,deployed_at desc;

revoke all on public.platform_current_deployment from public,anon;
grant select on public.platform_current_deployment to authenticated;

comment on table public.platform_deployment_releases is 'Histórico auditável de versões implantadas, smoke test e candidatos seguros a rollback.';
