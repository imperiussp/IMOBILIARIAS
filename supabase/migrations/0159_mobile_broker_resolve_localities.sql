create or replace function public.mobile_broker_resolve_city(
  p_agency_id uuid,
  p_name text,
  p_state_code text default null
)
returns table(id uuid, name text, state_code character)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := nullif(trim(coalesce(p_name,'')), '');
  v_state text := upper(left(trim(coalesce(p_state_code,'')),2));
  v_norm text;
  v_id uuid;
  v_count integer := 0;
begin
  if not (
    public.can_manage_agency(p_agency_id)
    or public.is_platform_admin()
    or (
      exists (
        select 1 from public.agency_memberships am
        where am.agency_id=p_agency_id
          and am.user_id=auth.uid()
          and am.active=true
          and am.role='broker'
      )
      and exists (
        select 1 from public.brokers b
        where b.agency_id=p_agency_id
          and b.user_id=auth.uid()
          and b.active=true
      )
    )
  ) then
    raise exception 'Acesso negado para preparar cidade no aplicativo.';
  end if;

  if v_name is null then raise exception 'Informe a cidade.'; end if;
  v_norm := translate(lower(v_name), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');

  if length(v_state)=2 then
    select c.id into v_id
    from public.cities c
    where translate(lower(trim(c.name)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')=v_norm
      and upper(c.state_code::text)=v_state
    limit 1;
  else
    select count(*), min(c.id) into v_count, v_id
    from public.cities c
    where translate(lower(trim(c.name)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')=v_norm;
    if v_count <> 1 then v_id := null; end if;
  end if;

  if v_id is null then
    if length(v_state)<>2 then
      raise exception 'Selecione a UF da cidade no aplicativo.';
    end if;
    insert into public.cities(name,state_code)
    values (v_name,v_state)
    on conflict do nothing;
    select c.id into v_id
    from public.cities c
    where translate(lower(trim(c.name)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')=v_norm
      and upper(c.state_code::text)=v_state
    limit 1;
  end if;

  if v_id is null then raise exception 'Não foi possível preparar a cidade.'; end if;
  return query select c.id,c.name,c.state_code from public.cities c where c.id=v_id;
end;
$function$;

create or replace function public.mobile_broker_resolve_neighborhood(
  p_agency_id uuid,
  p_city_id uuid,
  p_name text
)
returns table(id uuid, city_id uuid, name text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := nullif(trim(coalesce(p_name,'')), '');
  v_id uuid;
begin
  if not (
    public.can_manage_agency(p_agency_id)
    or public.is_platform_admin()
    or (
      exists (
        select 1 from public.agency_memberships am
        where am.agency_id=p_agency_id
          and am.user_id=auth.uid()
          and am.active=true
          and am.role='broker'
      )
      and exists (
        select 1 from public.brokers b
        where b.agency_id=p_agency_id
          and b.user_id=auth.uid()
          and b.active=true
      )
    )
  ) then
    raise exception 'Acesso negado para preparar bairro no aplicativo.';
  end if;
  if v_name is null then raise exception 'Informe o bairro.'; end if;
  if not exists(select 1 from public.cities c where c.id=p_city_id) then raise exception 'Cidade não encontrada.'; end if;

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

  return query select n.id,n.city_id,n.name from public.neighborhoods n where n.id=v_id;
end;
$function$;

grant execute on function public.mobile_broker_resolve_city(uuid,text,text) to authenticated;
grant execute on function public.mobile_broker_resolve_neighborhood(uuid,uuid,text) to authenticated;
