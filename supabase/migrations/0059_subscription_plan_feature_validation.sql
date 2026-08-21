-- Valida recursos comerciais configuráveis dos planos.
-- Mantém somente um plano ativo marcado como default_trial e normaliza trial_days.

create or replace function public.validate_subscription_plan_features()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  trial_days_text text;
  trial_days_value integer;
begin
  new.features := coalesce(new.features, '{}'::jsonb);
  trial_days_text := nullif(trim(coalesce(new.features ->> 'trial_days', '')), '');

  if trial_days_text is not null then
    begin
      trial_days_value := trial_days_text::integer;
    exception when invalid_text_representation then
      raise exception 'trial_days precisa ser um número inteiro.';
    end;
    if trial_days_value < 1 or trial_days_value > 90 then
      raise exception 'trial_days deve ficar entre 1 e 90 dias.';
    end if;
    new.features := jsonb_set(new.features, '{trial_days}', to_jsonb(trial_days_value), true);
  end if;

  if new.active = true
     and lower(coalesce(new.features ->> 'default_trial','false')) in ('true','1','yes','on')
     and exists (
       select 1 from public.subscription_plans sp
       where sp.id <> coalesce(new.id, gen_random_uuid())
         and sp.active = true
         and lower(coalesce(sp.features ->> 'default_trial','false')) in ('true','1','yes','on')
     ) then
    raise exception 'Já existe outro plano ativo definido como plano padrão de teste.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_subscription_plan_features() from public;

drop trigger if exists subscription_plans_validate_features on public.subscription_plans;
create trigger subscription_plans_validate_features
before insert or update on public.subscription_plans
for each row execute function public.validate_subscription_plan_features();
