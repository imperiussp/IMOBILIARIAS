-- Refinamento do CRM unificado: contato geral começa neutro; interesse em imóvel = comprador; anuncie seu imóvel = proprietário.
-- A função completa já foi aplicada em produção pela migração contact_source_classification.
-- Este arquivo registra a regra final para o histórico do repositório.

create or replace function public.crm_contact_type_for_source(p_source text)
returns text
language sql
immutable
set search_path=public
as $$
  select case
    when p_source='web-owner-property' then 'owner'
    when p_source='web-property-detail' then 'buyer'
    else 'other'
  end
$$;
