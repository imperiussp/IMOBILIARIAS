-- Vincula automaticamente um plano de teste configurável sem inventar preço ou limites.
-- O plano escolhido é aquele com features.default_trial=true.

create or replace function public.attach_default_trial_plan_to_agency_from_id(p_agency_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trial_plan_id uuid;
  trial_days integer;
begin
  if exists (
    select 1 from public.agency_subscriptions s
    where s.agency_id = p_agency_id
      and s.status in ('trial','active','past_due')
  ) then
    return;
  end if;

  select sp.id,
         greatest(1, least(90, coalesce(nullif(sp.features ->> 'trial_days', '')::integer, 14)))
  into trial_plan_id, trial_days
  from public.subscription_plans sp
  where sp.active = true
    and lower(coalesce(sp.features ->> 'default_trial', 'false')) in ('true','1','yes','on')
  order by sp.display_order asc, sp.created_at asc
  limit 1;

  if trial_plan_id is not null then
    insert into public.agency_subscriptions (
      agency_id, plan_id, status, starts_at, renews_at, ends_at
    ) values (
      p_agency_id,
      trial_plan_id,
      'trial',
      now(),
      now() + make_interval(days => trial_days),
      now() + make_interval(days => trial_days)
    );
  end if;
end;
$$;

-- Helper interno: não é chamável pelo navegador.
revoke all on function public.attach_default_trial_plan_to_agency_from_id(uuid) from public;
revoke all on function public.attach_default_trial_plan_to_agency_from_id(uuid) from anon, authenticated;

create or replace function public.attach_default_trial_plan_to_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.attach_default_trial_plan_to_agency_from_id(new.id);
  return new;
end;
$$;

revoke all on function public.attach_default_trial_plan_to_agency() from public;
revoke all on function public.attach_default_trial_plan_to_agency() from anon, authenticated;

drop trigger if exists agencies_attach_default_trial_plan on public.agencies;
create trigger agencies_attach_default_trial_plan
after insert on public.agencies
for each row execute function public.attach_default_trial_plan_to_agency();

-- Backfill apenas para imobiliárias sem assinatura atual e somente se houver plano marcado como default_trial.
do $$
declare
  agency_row record;
begin
  for agency_row in
    select a.id from public.agencies a
    where not exists (
      select 1 from public.agency_subscriptions s
      where s.agency_id = a.id and s.status in ('trial','active','past_due')
    )
  loop
    perform public.attach_default_trial_plan_to_agency_from_id(agency_row.id);
  end loop;
end $$;
