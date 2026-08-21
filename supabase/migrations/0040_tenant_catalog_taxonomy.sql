-- Tipos, características e bairros podem ter itens globais da plataforma
-- e itens próprios de cada imobiliária.

alter table public.neighborhoods
add column if not exists agency_id uuid references public.agencies(id) on delete cascade;

alter table public.property_types
add column if not exists agency_id uuid references public.agencies(id) on delete cascade;

alter table public.property_features
add column if not exists agency_id uuid references public.agencies(id) on delete cascade;

-- As linhas existentes permanecem globais (agency_id null) e podem ser reutilizadas por todos.
alter table public.neighborhoods drop constraint if exists neighborhoods_city_id_name_key;
alter table public.property_types drop constraint if exists property_types_name_key;
alter table public.property_types drop constraint if exists property_types_slug_key;
alter table public.property_features drop constraint if exists property_features_name_key;
alter table public.property_features drop constraint if exists property_features_slug_key;

create unique index if not exists neighborhoods_global_name_unique_idx
on public.neighborhoods (city_id, lower(name))
where agency_id is null;

create unique index if not exists neighborhoods_tenant_name_unique_idx
on public.neighborhoods (agency_id, city_id, lower(name))
where agency_id is not null;

create unique index if not exists property_types_global_name_unique_idx
on public.property_types (lower(name))
where agency_id is null;

create unique index if not exists property_types_tenant_name_unique_idx
on public.property_types (agency_id, lower(name))
where agency_id is not null;

create unique index if not exists property_types_global_slug_unique_idx
on public.property_types (lower(slug))
where agency_id is null;

create unique index if not exists property_types_tenant_slug_unique_idx
on public.property_types (agency_id, lower(slug))
where agency_id is not null;

create unique index if not exists property_features_global_name_unique_idx
on public.property_features (lower(name))
where agency_id is null;

create unique index if not exists property_features_tenant_name_unique_idx
on public.property_features (agency_id, lower(name))
where agency_id is not null;

create unique index if not exists property_features_global_slug_unique_idx
on public.property_features (lower(slug))
where agency_id is null;

create unique index if not exists property_features_tenant_slug_unique_idx
on public.property_features (agency_id, lower(slug))
where agency_id is not null;

create index if not exists neighborhoods_agency_city_idx
on public.neighborhoods (agency_id, city_id, name);

create index if not exists property_types_agency_active_idx
on public.property_types (agency_id, active, name);

create index if not exists property_features_agency_name_idx
on public.property_features (agency_id, name);

-- Compatibilidade com os formulários antigos: ao criar um bairro sem agency_id,
-- uma conta gestora de apenas um tenant recebe automaticamente o tenant correto.
create or replace function public.assign_neighborhood_agency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_agency uuid;
  agency_count integer;
begin
  if new.agency_id is not null or public.is_admin() then
    return new;
  end if;

  select count(*), min(am.agency_id)
    into agency_count, target_agency
  from public.agency_memberships am
  where am.user_id = auth.uid()
    and am.active = true
    and am.role in ('owner','admin');

  if agency_count <> 1 or target_agency is null then
    raise exception 'Informe explicitamente a imobiliária ao cadastrar o bairro.';
  end if;

  new.agency_id := target_agency;
  return new;
end;
$$;

drop trigger if exists neighborhoods_assign_agency_trigger on public.neighborhoods;
create trigger neighborhoods_assign_agency_trigger
before insert on public.neighborhoods
for each row execute function public.assign_neighborhood_agency();

-- Remove as regras antigas amplas e permite leitura apenas de itens globais
-- ou itens pertencentes às imobiliárias do usuário autenticado.
drop policy if exists "public read neighborhoods" on public.neighborhoods;
drop policy if exists "public read property types" on public.property_types;
drop policy if exists "public read property features" on public.property_features;
drop policy if exists "admins manage neighborhoods" on public.neighborhoods;
drop policy if exists "admins manage property types" on public.property_types;
drop policy if exists "admins manage features" on public.property_features;

create policy "read global or tenant neighborhoods" on public.neighborhoods
for select to anon, authenticated
using (
  agency_id is null
  or (auth.uid() is not null and (public.is_admin() or public.is_agency_member(agency_id)))
);

create policy "read global or tenant property types" on public.property_types
for select to anon, authenticated
using (
  (agency_id is null and active = true)
  or (auth.uid() is not null and public.is_admin())
  or (agency_id is not null and auth.uid() is not null and public.is_agency_member(agency_id))
);

create policy "read global or tenant property features" on public.property_features
for select to anon, authenticated
using (
  agency_id is null
  or (auth.uid() is not null and (public.is_admin() or public.is_agency_member(agency_id)))
);

create policy "tenant managers manage neighborhoods" on public.neighborhoods
for all to authenticated
using (agency_id is not null and public.can_manage_agency(agency_id))
with check (agency_id is not null and public.can_manage_agency(agency_id));

create policy "tenant managers manage property types" on public.property_types
for all to authenticated
using (agency_id is not null and public.can_manage_agency(agency_id))
with check (agency_id is not null and public.can_manage_agency(agency_id));

create policy "tenant managers manage property features" on public.property_features
for all to authenticated
using (agency_id is not null and public.can_manage_agency(agency_id))
with check (agency_id is not null and public.can_manage_agency(agency_id));

create policy "platform admins manage global neighborhoods" on public.neighborhoods
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "platform admins manage global property types" on public.property_types
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "platform admins manage global property features" on public.property_features
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Um vínculo de característica só é válido quando o imóvel e a característica
-- pertencem ao mesmo tenant, ou quando a característica é global.
create or replace function public.enforce_property_feature_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  property_agency uuid;
  feature_agency uuid;
begin
  select p.agency_id into property_agency
  from public.properties p
  where p.id = new.property_id;

  select f.agency_id into feature_agency
  from public.property_features f
  where f.id = new.feature_id;

  if property_agency is null then
    raise exception 'Imóvel sem imobiliária vinculada.';
  end if;

  if feature_agency is not null and feature_agency <> property_agency then
    raise exception 'A característica pertence a outra imobiliária.';
  end if;

  return new;
end;
$$;

drop trigger if exists property_feature_tenant_guard on public.property_feature_links;
create trigger property_feature_tenant_guard
before insert or update on public.property_feature_links
for each row execute function public.enforce_property_feature_tenant();

-- Proprietários/admins e corretores podem gerenciar características dos imóveis
-- que já podem gerenciar dentro do próprio tenant.
drop policy if exists "admins manage feature links" on public.property_feature_links;

create policy "tenant managers manage feature links" on public.property_feature_links
for all to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_id and public.can_manage_agency(p.agency_id)
  )
)
with check (
  exists (
    select 1 from public.properties p
    where p.id = property_id and public.can_manage_agency(p.agency_id)
  )
);

create policy "tenant brokers manage assigned feature links" on public.property_feature_links
for all to authenticated
using (
  exists (
    select 1
    from public.properties p
    join public.brokers b on b.id = p.broker_id and b.agency_id = p.agency_id
    where p.id = property_id
      and b.user_id = auth.uid()
      and b.active = true
      and public.can_sell_for_agency(p.agency_id)
  )
)
with check (
  exists (
    select 1
    from public.properties p
    join public.brokers b on b.id = p.broker_id and b.agency_id = p.agency_id
    where p.id = property_id
      and b.user_id = auth.uid()
      and b.active = true
      and public.can_sell_for_agency(p.agency_id)
  )
);
