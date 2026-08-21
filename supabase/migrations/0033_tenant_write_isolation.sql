-- Isolamento forte entre imobiliárias (tenants).
-- Mantém administradores globais da plataforma com acesso operacional total,
-- mas usuários de cada imobiliária só podem atuar dentro da própria agency_id.

create or replace function public.is_agency_member(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_memberships am
    where am.agency_id = p_agency_id
      and am.user_id = auth.uid()
      and am.active = true
  )
$$;

create or replace function public.can_manage_agency(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.agency_memberships am
    where am.agency_id = p_agency_id
      and am.user_id = auth.uid()
      and am.active = true
      and am.role in ('owner','admin')
  )
$$;

create or replace function public.can_sell_for_agency(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.agency_memberships am
    where am.agency_id = p_agency_id
      and am.user_id = auth.uid()
      and am.active = true
      and am.role in ('owner','admin','broker')
  )
$$;

grant execute on function public.is_agency_member(uuid) to authenticated;
grant execute on function public.can_manage_agency(uuid) to authenticated;
grant execute on function public.can_sell_for_agency(uuid) to authenticated;

-- Depois do backfill da migration 0031, tenant passa a ser obrigatório.
alter table public.properties alter column agency_id set not null;
alter table public.brokers alter column agency_id set not null;
alter table public.leads alter column agency_id set not null;
alter table public.agency_subscriptions alter column agency_id set not null;

-- PROPERTIES: remove regras globais antigas e aplica escopo de tenant.
drop policy if exists "admins manage properties" on public.properties;
drop policy if exists "brokers manage own properties" on public.properties;

create policy "tenant managers manage properties" on public.properties
for all to authenticated
using (public.can_manage_agency(agency_id))
with check (public.can_manage_agency(agency_id));

create policy "tenant brokers manage assigned properties" on public.properties
for all to authenticated
using (
  public.can_sell_for_agency(agency_id)
  and exists (
    select 1 from public.brokers b
    where b.id = broker_id
      and b.agency_id = properties.agency_id
      and b.user_id = auth.uid()
      and b.active = true
  )
)
with check (
  public.can_sell_for_agency(agency_id)
  and exists (
    select 1 from public.brokers b
    where b.id = broker_id
      and b.agency_id = properties.agency_id
      and b.user_id = auth.uid()
      and b.active = true
  )
);

-- BROKERS: administradores da imobiliária gerenciam equipe; corretor lê o próprio perfil.
drop policy if exists "admins manage brokers" on public.brokers;
drop policy if exists "brokers read own profile" on public.brokers;

create policy "tenant managers manage brokers" on public.brokers
for all to authenticated
using (public.can_manage_agency(agency_id))
with check (public.can_manage_agency(agency_id));

create policy "brokers read own tenant profile" on public.brokers
for select to authenticated
using (
  agency_id in (select public.current_agency_ids())
  and user_id = auth.uid()
);

-- PHOTOS: sempre herdam a imobiliária do imóvel relacionado.
drop policy if exists "admins manage property photos" on public.property_photos;
drop policy if exists "brokers manage photos of own properties" on public.property_photos;

create policy "tenant managers manage property photos" on public.property_photos
for all to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.can_manage_agency(p.agency_id)
  )
)
with check (
  exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.can_manage_agency(p.agency_id)
  )
);

create policy "tenant brokers manage assigned property photos" on public.property_photos
for all to authenticated
using (
  exists (
    select 1
    from public.properties p
    join public.brokers b on b.id = p.broker_id
    where p.id = property_id
      and b.agency_id = p.agency_id
      and b.user_id = auth.uid()
      and b.active = true
      and public.can_sell_for_agency(p.agency_id)
  )
)
with check (
  exists (
    select 1
    from public.properties p
    join public.brokers b on b.id = p.broker_id
    where p.id = property_id
      and b.agency_id = p.agency_id
      and b.user_id = auth.uid()
      and b.active = true
      and public.can_sell_for_agency(p.agency_id)
  )
);

-- LEADS: público só cria lead no tenant informado; gestão permanece isolada.
drop policy if exists "admins read leads" on public.leads;
drop policy if exists "admins manage leads" on public.leads;
drop policy if exists "brokers read own leads" on public.leads;
drop policy if exists "brokers update own leads" on public.leads;
drop policy if exists "public create valid leads" on public.leads;

create policy "public create tenant lead" on public.leads
for insert to anon, authenticated
with check (
  agency_id is not null
  and exists (
    select 1 from public.agencies a
    where a.id = agency_id and a.status in ('trial','active','past_due')
  )
  and (
    property_id is null
    or exists (
      select 1 from public.properties p
      where p.id = property_id
        and p.agency_id = leads.agency_id
        and p.publication_state = 'published'
        and p.status in ('available','reserved','rented','sold')
    )
  )
  and (
    broker_id is null
    or exists (
      select 1 from public.brokers b
      where b.id = broker_id
        and b.agency_id = leads.agency_id
        and b.active = true
    )
  )
);

create policy "tenant managers manage leads" on public.leads
for all to authenticated
using (public.can_manage_agency(agency_id))
with check (public.can_manage_agency(agency_id));

create policy "tenant brokers read own leads" on public.leads
for select to authenticated
using (
  exists (
    select 1 from public.brokers b
    where b.id = broker_id
      and b.agency_id = leads.agency_id
      and b.user_id = auth.uid()
      and b.active = true
  )
);

create policy "tenant brokers update own leads" on public.leads
for update to authenticated
using (
  exists (
    select 1 from public.brokers b
    where b.id = broker_id
      and b.agency_id = leads.agency_id
      and b.user_id = auth.uid()
      and b.active = true
  )
)
with check (
  exists (
    select 1 from public.brokers b
    where b.id = broker_id
      and b.agency_id = leads.agency_id
      and b.user_id = auth.uid()
      and b.active = true
  )
);

-- ASSINATURAS: cada imobiliária enxerga somente a própria assinatura.
drop policy if exists "admins manage agency subscription" on public.agency_subscriptions;
drop policy if exists "authorized users read current subscription" on public.agency_subscriptions;

create policy "platform admins manage subscriptions" on public.agency_subscriptions
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "tenant members read own subscription" on public.agency_subscriptions
for select to authenticated
using (agency_id in (select public.current_agency_ids()));

-- Integridade: corretor e lead não podem apontar para outra imobiliária.
create or replace function public.enforce_tenant_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'properties' and new.broker_id is not null then
    if not exists (select 1 from public.brokers b where b.id = new.broker_id and b.agency_id = new.agency_id) then
      raise exception 'Corretor não pertence à imobiliária do imóvel.';
    end if;
  end if;

  if tg_table_name = 'leads' then
    if new.property_id is not null and not exists (select 1 from public.properties p where p.id = new.property_id and p.agency_id = new.agency_id) then
      raise exception 'Imóvel não pertence à imobiliária do lead.';
    end if;
    if new.broker_id is not null and not exists (select 1 from public.brokers b where b.id = new.broker_id and b.agency_id = new.agency_id) then
      raise exception 'Corretor não pertence à imobiliária do lead.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists properties_tenant_links_trigger on public.properties;
create trigger properties_tenant_links_trigger
before insert or update of agency_id, broker_id on public.properties
for each row execute function public.enforce_tenant_links();

drop trigger if exists leads_tenant_links_trigger on public.leads;
create trigger leads_tenant_links_trigger
before insert or update of agency_id, property_id, broker_id on public.leads
for each row execute function public.enforce_tenant_links();
