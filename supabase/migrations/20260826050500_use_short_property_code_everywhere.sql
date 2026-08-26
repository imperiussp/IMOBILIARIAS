create or replace function public.assign_property_display_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
begin
  if new.display_code is null or btrim(new.display_code) = '' then
    v_prefix := public.property_display_prefix(new.property_type_id);
    perform pg_advisory_xact_lock(hashtext(new.agency_id::text || ':' || v_prefix));
    select coalesce(max((substring(display_code from '([0-9]+)$'))::integer), 9) + 1 into v_next
    from public.properties
    where agency_id = new.agency_id and display_code ~ ('^' || v_prefix || '[0-9]+$') and (tg_op = 'INSERT' or id <> new.id);
    new.display_code := v_prefix || v_next::text;
  else
    new.display_code := upper(regexp_replace(btrim(new.display_code), '[^A-Za-z0-9-]', '', 'g'));
  end if;
  new.code := new.display_code;
  return new;
end;
$$;

update public.properties
set code = display_code
where display_code is not null and btrim(display_code) <> '' and code is distinct from display_code;
