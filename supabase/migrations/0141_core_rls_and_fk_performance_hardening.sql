-- Conservador: reduz reavaliação de auth.uid() em políticas simples e adiciona índices de FK de alto uso.
-- Não altera escopo de acesso, papéis ou isolamento entre tenants.

alter policy "authenticated manage own favorites"
on public.favorites
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy "authenticated manage own sync jobs"
on public.synchronization_jobs
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy "users read own role"
on public.user_roles
using (((select auth.uid()) = user_id) or is_admin());

alter policy "users read own profile"
on public.profiles
using (((select auth.uid()) = user_id) or is_admin());

alter policy "users update own profile"
on public.profiles
using (((select auth.uid()) = user_id) or is_admin())
with check (((select auth.uid()) = user_id) or is_admin());

alter policy "members read own memberships"
on public.agency_memberships
using (((select auth.uid()) = user_id) or (agency_id in (select current_agency_ids())));

create index if not exists agency_memberships_user_id_idx
  on public.agency_memberships (user_id);

create index if not exists synchronization_jobs_user_id_idx
  on public.synchronization_jobs (user_id);

create index if not exists favorites_property_id_idx
  on public.favorites (property_id);

create index if not exists properties_neighborhood_id_idx
  on public.properties (neighborhood_id);

create index if not exists properties_property_type_id_idx
  on public.properties (property_type_id);
