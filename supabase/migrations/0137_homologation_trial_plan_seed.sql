-- Plano interno temporário para homologação funcional.
-- Não representa oferta comercial definitiva e deve ser desativado/substituído antes da abertura pública.

insert into public.subscription_plans (
  code,
  name,
  description,
  monthly_price,
  annual_price,
  max_properties,
  max_users,
  max_ai_descriptions,
  features,
  active,
  display_order
)
values (
  'homologacao',
  'Homologação',
  'Plano interno temporário para validação funcional antes do lançamento.',
  null,
  null,
  100,
  10,
  0,
  jsonb_build_object(
    'default_trial', true,
    'trial_days', 14,
    'internal_only', true,
    'custom_domain', false,
    'ai_descriptions', false
  ),
  true,
  -100
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  max_properties = excluded.max_properties,
  max_users = excluded.max_users,
  max_ai_descriptions = excluded.max_ai_descriptions,
  features = excluded.features,
  active = true,
  display_order = excluded.display_order,
  updated_at = now();

select public.attach_default_trial_plan_to_agency_from_id(id)
from public.agencies
where not exists (
  select 1
  from public.agency_subscriptions s
  where s.agency_id = agencies.id
    and s.status in ('trial','active','past_due')
);
