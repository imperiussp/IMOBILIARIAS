-- Contas já existentes no plano de homologação não devem ser convertidas em
-- cobrança real retroativamente. O plano homologacao é interno e continua
-- liberando os trials existentes até o fim da vigência.
update public.subscription_plans
set features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
      'internal_only', true,
      'commercial', false,
      'default_trial', true
    ),
    active = true,
    updated_at = now()
where code = 'homologacao';
