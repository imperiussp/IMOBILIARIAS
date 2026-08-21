-- Permite que o mesmo usuário/corretor atue em mais de uma imobiliária.
-- O vínculo passa a ser único por (agency_id, user_id), e não globalmente por user_id.

alter table public.brokers
  drop constraint if exists brokers_user_id_key;

drop index if exists brokers_user_id_key;

create unique index if not exists brokers_agency_user_unique_idx
on public.brokers (agency_id, user_id)
where user_id is not null;

create index if not exists brokers_user_agency_lookup_idx
on public.brokers (user_id, agency_id, active)
where user_id is not null;

-- Um corretor nunca pode apontar para uma imobiliária diferente daquela do seu vínculo.
create or replace function public.validate_broker_agency_membership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.agency_memberships am
    where am.agency_id = new.agency_id
      and am.user_id = new.user_id
      and am.active = true
      and am.role in ('owner','admin','broker')
  ) then
    raise exception 'O usuário precisa possuir vínculo ativo com esta imobiliária antes de ser associado como corretor.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_broker_agency_membership() from public;

drop trigger if exists brokers_validate_agency_membership on public.brokers;
create trigger brokers_validate_agency_membership
before insert or update of user_id, agency_id on public.brokers
for each row execute function public.validate_broker_agency_membership();
