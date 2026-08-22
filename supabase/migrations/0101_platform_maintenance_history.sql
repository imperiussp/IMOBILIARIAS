-- Histórico técnico do orquestrador de manutenção.
-- Visível somente para administradores da plataforma.

create table if not exists public.platform_maintenance_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  success boolean not null default false,
  failed_tasks integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_maintenance_runs_started_idx
  on public.platform_maintenance_runs(started_at desc);

alter table public.platform_maintenance_runs enable row level security;

drop policy if exists "platform admins read maintenance history" on public.platform_maintenance_runs;
create policy "platform admins read maintenance history"
on public.platform_maintenance_runs
for select to authenticated
using (public.is_platform_admin());

revoke insert,update,delete on public.platform_maintenance_runs from anon,authenticated;
grant select on public.platform_maintenance_runs to authenticated;
