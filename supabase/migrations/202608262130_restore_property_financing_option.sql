alter table public.properties
  add column if not exists financing_accepted boolean;

comment on column public.properties.financing_accepted is
  'Indica se o imóvel aceita financiamento. NULL = não informado, true = sim, false = não.';
