-- Criação segura de cidades/bairros por imobiliária.
-- Resolve o bloqueio de RLS ao cadastrar uma cidade nova sem abrir escrita direta global em cities.

create or replace function public.agency_upsert_city(
  p_agency_id uuid,
  p_name text,
  p_state_code text
)
returns table(id uuid, name text, state_code char(2))
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name,'')), '');
  v_state text := upper(left(trim(coalesce(p_state_code,'')),2));
  v_id uuid;
begin
  if not public.can_manage_agency(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado para cadastrar cidade nesta imobiliária.';
  end if;
  if v_name is null then raise exception 'Informe o nome da cidade.'; end if;
  if length(v_state) <> 2 then raise exception 'Informe a UF com 2 letras.'; end if;

  select c.id into v_id
  from public.cities c
  where lower(trim(c.name)) = lower(v_name)
    and upper(c.state_code::text) = v_state
  limit 1;

  if v_id is null then
    insert into public.cities(name,state_code)
    values (v_name,v_state)
    returning public.cities.id into v_id;
  end if;

  return query
  select c.id,c.name,c.state_code
  from public.cities c
  where c.id=v_id;
end;
$$;

revoke all on function public.agency_upsert_city(uuid,text,text) from public;
grant execute on function public.agency_upsert_city(uuid,text,text) to authenticated;

create or replace function public.agency_upsert_neighborhood(
  p_agency_id uuid,
  p_city_id uuid,
  p_name text
)
returns table(id uuid, city_id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name,'')), '');
  v_id uuid;
begin
  if not public.can_manage_agency(p_agency_id) and not public.is_platform_admin() then
    raise exception 'Acesso negado para cadastrar bairro nesta imobiliária.';
  end if;
  if v_name is null then raise exception 'Informe o nome do bairro.'; end if;
  if not exists(select 1 from public.cities c where c.id=p_city_id) then
    raise exception 'Cidade não encontrada.';
  end if;

  select n.id into v_id
  from public.neighborhoods n
  where n.city_id=p_city_id
    and lower(trim(n.name))=lower(v_name)
    and (n.agency_id=p_agency_id or n.agency_id is null)
  order by (n.agency_id=p_agency_id) desc
  limit 1;

  if v_id is null then
    insert into public.neighborhoods(agency_id,city_id,name)
    values(p_agency_id,p_city_id,v_name)
    returning public.neighborhoods.id into v_id;
  end if;

  return query
  select n.id,n.city_id,n.name
  from public.neighborhoods n
  where n.id=v_id;
end;
$$;

revoke all on function public.agency_upsert_neighborhood(uuid,uuid,text) from public;
grant execute on function public.agency_upsert_neighborhood(uuid,uuid,text) to authenticated;
