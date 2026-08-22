-- Controles globais de homologacao/lancamento da plataforma.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create table if not exists public.platform_release_controls (
  id smallint primary key default 1 check (id=1),
  environment_mode text not null default 'homologation' check (environment_mode in ('development','homologation','production')),
  maintenance_mode boolean not null default false,
  public_catalog_enabled boolean not null default true,
  new_registrations_enabled boolean not null default false,
  real_billing_enabled boolean not null default false,
  external_messaging_enabled boolean not null default false,
  ai_generation_enabled boolean not null default false,
  release_label text not null default 'Homologacao interna',
  release_notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.platform_release_controls(id)
values (1)
on conflict (id) do nothing;

create table if not exists public.platform_release_control_history (
  id uuid primary key default gen_random_uuid(),
  environment_mode text not null,
  maintenance_mode boolean not null,
  public_catalog_enabled boolean not null,
  new_registrations_enabled boolean not null,
  real_billing_enabled boolean not null,
  external_messaging_enabled boolean not null,
  ai_generation_enabled boolean not null,
  release_label text not null,
  release_notes text,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

alter table public.platform_release_controls enable row level security;
alter table public.platform_release_control_history enable row level security;

revoke all on public.platform_release_controls from public,anon,authenticated;
revoke all on public.platform_release_control_history from public,anon,authenticated;

drop policy if exists "platform admins read release controls" on public.platform_release_controls;
create policy "platform admins read release controls" on public.platform_release_controls
for select to authenticated using (public.is_platform_admin());

drop policy if exists "platform admins update release controls" on public.platform_release_controls;
create policy "platform admins update release controls" on public.platform_release_controls
for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "platform admins read release history" on public.platform_release_control_history;
create policy "platform admins read release history" on public.platform_release_control_history
for select to authenticated using (public.is_platform_admin());

grant select,update on public.platform_release_controls to authenticated;
grant select on public.platform_release_control_history to authenticated;

create or replace function public.capture_platform_release_control_history()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.updated_at:=now();
  new.updated_by:=auth.uid();
  insert into public.platform_release_control_history(
    environment_mode,maintenance_mode,public_catalog_enabled,new_registrations_enabled,
    real_billing_enabled,external_messaging_enabled,ai_generation_enabled,
    release_label,release_notes,changed_by
  ) values (
    new.environment_mode,new.maintenance_mode,new.public_catalog_enabled,new.new_registrations_enabled,
    new.real_billing_enabled,new.external_messaging_enabled,new.ai_generation_enabled,
    new.release_label,new.release_notes,auth.uid()
  );
  return new;
end;
$$;
revoke all on function public.capture_platform_release_control_history() from public,anon,authenticated;

drop trigger if exists platform_release_controls_history on public.platform_release_controls;
create trigger platform_release_controls_history
before update on public.platform_release_controls
for each row execute function public.capture_platform_release_control_history();

create or replace function public.platform_runtime_flag(p_flag text)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare v public.platform_release_controls%rowtype;
begin
  select * into v from public.platform_release_controls where id=1;
  if not found then return false; end if;
  return case p_flag
    when 'maintenance_mode' then v.maintenance_mode
    when 'public_catalog_enabled' then v.public_catalog_enabled
    when 'new_registrations_enabled' then v.new_registrations_enabled
    when 'real_billing_enabled' then v.real_billing_enabled
    when 'external_messaging_enabled' then v.external_messaging_enabled
    when 'ai_generation_enabled' then v.ai_generation_enabled
    else false
  end;
end;
$$;
revoke all on function public.platform_runtime_flag(text) from public,anon;
grant execute on function public.platform_runtime_flag(text) to authenticated;

comment on table public.platform_release_controls is 'Freios globais para homologacao e lancamento. Padrao conservador: cobranca, mensageria externa, IA e novos cadastros desligados.';
