alter table public.agencies
  add column if not exists hero_background_url text;

create or replace function public.resolve_agency_hero_background(p_agency_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.hero_background_url
  from public.agencies a
  where a.id = p_agency_id
    and a.status in ('trial','active','past_due')
  limit 1
$$;

revoke all on function public.resolve_agency_hero_background(uuid) from public;
grant execute on function public.resolve_agency_hero_background(uuid) to anon, authenticated;

create or replace function public.set_agency_hero_background(p_agency_id uuid, p_url text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_url text := nullif(trim(coalesce(p_url, '')), '');
  v_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select public.is_platform_admin() or exists (
    select 1
    from public.agency_memberships am
    where am.agency_id = p_agency_id
      and am.user_id = auth.uid()
      and am.active = true
      and am.role in ('owner','admin','broker')
  ) into v_allowed;

  if not coalesce(v_allowed, false) then
    raise exception 'Not allowed to change this agency background';
  end if;

  if v_url is not null and position(
    '/storage/v1/object/public/agency-branding/' || p_agency_id::text || '/branding/background-'
    in v_url
  ) = 0 then
    raise exception 'Invalid background image URL';
  end if;

  update public.agencies
  set hero_background_url = v_url,
      updated_at = now()
  where id = p_agency_id;

  if not found then
    raise exception 'Agency not found';
  end if;

  return v_url;
end
$$;

revoke all on function public.set_agency_hero_background(uuid, text) from public;
grant execute on function public.set_agency_hero_background(uuid, text) to authenticated;

drop policy if exists "broker branding background insert" on storage.objects;
create policy "broker branding background insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agency-branding'
  and public.storage_agency_id(name) is not null
  and name like public.storage_agency_id(name)::text || '/branding/background-%'
  and exists (
    select 1
    from public.agency_memberships am
    where am.agency_id = public.storage_agency_id(name)
      and am.user_id = auth.uid()
      and am.active = true
      and am.role = 'broker'
  )
);
