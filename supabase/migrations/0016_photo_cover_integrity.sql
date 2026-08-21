create unique index if not exists property_photos_single_cover_idx
on public.property_photos (property_id)
where is_cover = true;

create or replace function public.normalize_property_photo_cover(target_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_id uuid;
begin
  if target_property_id is null then return; end if;

  select id into chosen_id
  from public.property_photos
  where property_id = target_property_id
  order by is_cover desc, position asc, created_at asc
  limit 1;

  if chosen_id is null then return; end if;

  update public.property_photos
  set is_cover = (id = chosen_id)
  where property_id = target_property_id
    and is_cover is distinct from (id = chosen_id);
end;
$$;

create or replace function public.ensure_property_photo_cover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.property_id, old.property_id);

  if tg_op = 'INSERT' then
    if not exists (select 1 from public.property_photos where property_id = new.property_id and id <> new.id and is_cover = true) then
      new.is_cover := true;
    elsif new.is_cover then
      update public.property_photos set is_cover = false where property_id = new.property_id and id <> new.id and is_cover = true;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.is_cover then
      update public.property_photos set is_cover = false where property_id = new.property_id and id <> new.id and is_cover = true;
    end if;
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists property_photo_cover_before_write on public.property_photos;
create trigger property_photo_cover_before_write
before insert or update of is_cover on public.property_photos
for each row execute function public.ensure_property_photo_cover();

create or replace function public.restore_property_photo_cover_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_cover then
    perform public.normalize_property_photo_cover(old.property_id);
  end if;
  return old;
end;
$$;

drop trigger if exists property_photo_cover_after_delete on public.property_photos;
create trigger property_photo_cover_after_delete
after delete on public.property_photos
for each row execute function public.restore_property_photo_cover_after_delete();

-- Normaliza dados existentes antes de uso em produção.
do $$
declare r record;
begin
  for r in select distinct property_id from public.property_photos loop
    perform public.normalize_property_photo_cover(r.property_id);
  end loop;
end $$;
