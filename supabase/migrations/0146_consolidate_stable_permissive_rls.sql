-- 0146: consolida policies permissivas sobrepostas em tabelas estáveis.
-- A autorização efetiva é preservada; apenas evitamos múltiplas policies permissivas para o mesmo role/action.

-- agencies: membro OU admin da plataforma.
drop policy if exists "members read own agency" on public.agencies;
drop policy if exists "platform admins read all agencies" on public.agencies;
create policy "members or platform admins read agencies"
on public.agencies
for select
to authenticated
using (
  id in (select public.current_agency_ids())
  or public.is_platform_admin()
);

-- agency_memberships: própria/tenant OU admin da plataforma.
drop policy if exists "members read own memberships" on public.agency_memberships;
drop policy if exists "platform admins read all memberships" on public.agency_memberships;
create policy "members or platform admins read memberships"
on public.agency_memberships
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or agency_id in (select public.current_agency_ids())
  or public.is_platform_admin()
);

-- profiles: a policy de gestores já contém os casos de próprio usuário e admin.
drop policy if exists "users read own profile" on public.profiles;

-- brokers: separa SELECT de escrita para evitar sobreposição da antiga policy ALL.
drop policy if exists "tenant managers manage brokers" on public.brokers;
drop policy if exists "brokers read own tenant profile" on public.brokers;

create policy "tenant members read broker profiles"
on public.brokers
for select
to authenticated
using (
  public.can_manage_agency(agency_id)
  or (
    agency_id in (select public.current_agency_ids())
    and user_id = (select auth.uid())
  )
);

create policy "tenant managers insert brokers"
on public.brokers
for insert
to authenticated
with check (public.can_manage_agency(agency_id));

create policy "tenant managers update brokers"
on public.brokers
for update
to authenticated
using (public.can_manage_agency(agency_id))
with check (public.can_manage_agency(agency_id));

create policy "tenant managers delete brokers"
on public.brokers
for delete
to authenticated
using (public.can_manage_agency(agency_id));

-- cities: leitura pública permanece; administração fica apenas nas escritas.
drop policy if exists "admins manage cities" on public.cities;
create policy "admins insert cities"
on public.cities
for insert
to authenticated
with check (public.is_admin());
create policy "admins update cities"
on public.cities
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy "admins delete cities"
on public.cities
for delete
to authenticated
using (public.is_admin());

-- document_templates: leitura ativa OU admin; escrita exclusiva do admin da plataforma.
drop policy if exists "platform admins manage document templates" on public.document_templates;
create policy "platform admins insert document templates"
on public.document_templates
for insert
to authenticated
with check (public.is_platform_admin());
create policy "platform admins update document templates"
on public.document_templates
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());
create policy "platform admins delete document templates"
on public.document_templates
for delete
to authenticated
using (public.is_platform_admin());

-- site_settings: preserva leitura do registro canônico para todos e leitura ampla para admin.
drop policy if exists "admins manage site settings" on public.site_settings;
drop policy if exists "public read site settings" on public.site_settings;
create policy "public or admins read site settings"
on public.site_settings
for select
to anon, authenticated
using (id = 1 or public.is_admin());
create policy "admins insert site settings"
on public.site_settings
for insert
to authenticated
with check (public.is_admin() and id = 1);
create policy "admins update site settings"
on public.site_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin() and id = 1);
create policy "admins delete site settings"
on public.site_settings
for delete
to authenticated
using (public.is_admin());

-- subscription_plans: público vê ativos; admin da plataforma preserva leitura ampla e escrita.
drop policy if exists "platform admins manage subscription plans" on public.subscription_plans;
drop policy if exists "public read active subscription plans" on public.subscription_plans;
create policy "public or platform admins read subscription plans"
on public.subscription_plans
for select
to anon, authenticated
using (active = true or public.is_platform_admin());
create policy "platform admins insert subscription plans"
on public.subscription_plans
for insert
to authenticated
with check (public.is_platform_admin());
create policy "platform admins update subscription plans"
on public.subscription_plans
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());
create policy "platform admins delete subscription plans"
on public.subscription_plans
for delete
to authenticated
using (public.is_platform_admin());