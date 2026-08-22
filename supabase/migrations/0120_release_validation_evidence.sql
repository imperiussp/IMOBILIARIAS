-- Evidências persistentes de homologação e go-live.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create table if not exists public.platform_release_validations (
  check_key text primary key,
  label text not null,
  category text not null,
  required_for_production boolean not null default false,
  validated boolean not null default false,
  notes text,
  validated_at timestamptz,
  validated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_release_validations(check_key,label,category,required_for_production)
values
  ('auth_login','Login, sessão e recuperação de acesso','Acesso',true),
  ('tenant_isolation_functional','Teste funcional entre duas imobiliárias','Segurança',true),
  ('property_crud','Cadastro, edição, publicação e exclusão lógica de imóvel','Imóveis',true),
  ('photo_storage','Upload, capa, ordem e isolamento das fotos','Storage',true),
  ('lead_crm','Entrada de lead e fluxo completo no CRM','CRM',true),
  ('broker_permissions','Permissões de corretor e administração','Segurança',true),
  ('mobile_offline_sync','Fila offline e sincronização do aplicativo','Aplicativo',false),
  ('dns_tls','DNS e HTTPS do domínio da plataforma','Infraestrutura',true),
  ('maintenance_cron','Cron de manutenção executando sem falhas','Operação',true),
  ('backup_recovery','Backup e procedimento de recuperação documentados','Continuidade',true),
  ('billing_controlled','Checkout/webhook financeiro controlado','Cobrança',false),
  ('messaging_controlled','WhatsApp/e-mail com destinatários de teste','Mensageria',false)
on conflict(check_key) do update set
  label=excluded.label,
  category=excluded.category,
  required_for_production=excluded.required_for_production;

alter table public.platform_release_validations enable row level security;
revoke all on public.platform_release_validations from public,anon,authenticated;

drop policy if exists "platform admins read release validations" on public.platform_release_validations;
create policy "platform admins read release validations" on public.platform_release_validations
for select to authenticated using (public.is_platform_admin());

drop policy if exists "platform admins update release validations" on public.platform_release_validations;
create policy "platform admins update release validations" on public.platform_release_validations
for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

grant select,update on public.platform_release_validations to authenticated;

create or replace function public.capture_release_validation_identity()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.updated_at=now();
  if new.validated is distinct from old.validated or new.notes is distinct from old.notes then
    if new.validated then
      new.validated_at=now();
      new.validated_by=auth.uid();
    else
      new.validated_at=null;
      new.validated_by=null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_release_validation_identity() from public,anon,authenticated;

drop trigger if exists release_validation_identity on public.platform_release_validations;
create trigger release_validation_identity
before update on public.platform_release_validations
for each row execute function public.capture_release_validation_identity();

create index if not exists platform_release_validations_required_idx
on public.platform_release_validations(required_for_production,validated);

comment on table public.platform_release_validations is
'Checklist persistente de evidências de homologação. Marcar validado significa que o teste foi realmente executado no ambiente correto.';
