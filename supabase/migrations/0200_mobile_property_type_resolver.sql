create or replace function public.mobile_broker_resolve_property_type(p_agency_id uuid, p_name text)
returns table(id uuid, name text)
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_name text := nullif(trim(coalesce(p_name,'')), '');
  v_norm text;
  v_id uuid;
  v_slug text;
begin
  if not (
    public.can_manage_agency(p_agency_id)
    or public.is_platform_admin()
    or (
      exists (
        select 1 from public.agency_memberships am
        where am.agency_id=p_agency_id and am.user_id=auth.uid() and am.active=true and am.role='broker'
      )
      and exists (
        select 1 from public.brokers b
        where b.agency_id=p_agency_id and b.user_id=auth.uid() and b.active=true
      )
    )
  ) then
    raise exception 'Acesso negado para preparar tipo de imóvel no aplicativo.';
  end if;
  if v_name is null then raise exception 'Informe o tipo de imóvel.'; end if;
  v_norm := translate(lower(v_name), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');

  select pt.id into v_id
  from public.property_types pt
  where translate(lower(trim(pt.name)), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')=v_norm
    and pt.active=true
    and (pt.agency_id=p_agency_id or pt.agency_id is null)
  order by (pt.agency_id=p_agency_id) desc
  limit 1;

  if v_id is null then
    v_slug := regexp_replace(v_norm, '[^a-z0-9]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
    if v_slug='' then v_slug := 'tipo'; end if;
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);
    insert into public.property_types(agency_id,name,slug,active)
    values(p_agency_id,v_name,v_slug,true)
    returning public.property_types.id into v_id;
  end if;

  return query select pt.id,pt.name from public.property_types pt where pt.id=v_id;
end;
$$;

grant execute on function public.mobile_broker_resolve_property_type(uuid,text) to authenticated;
