-- Cidade inicial mínima para homologação funcional do cadastro de imóveis.
-- A expansão do catálogo de cidades permanece responsabilidade da plataforma.

insert into public.cities (name, state_code)
select 'Sengés', 'PR'
where not exists (
  select 1
  from public.cities
  where lower(name) = lower('Sengés')
    and upper(state_code) = 'PR'
);
