insert into public.cities (name, state_code)
values ('Sengés', 'PR'), ('Itararé', 'SP')
on conflict (name, state_code) do nothing;

insert into public.property_types (name, slug)
values
  ('Casa', 'casa'),
  ('Apartamento', 'apartamento'),
  ('Comercial', 'comercial'),
  ('Rural', 'rural'),
  ('Terreno', 'terreno')
on conflict (slug) do nothing;

insert into public.property_features (name, slug)
values
  ('Suíte', 'suite'),
  ('Jardim', 'jardim'),
  ('Varanda', 'varanda'),
  ('Garagem coberta', 'garagem-coberta'),
  ('Área de lazer', 'area-de-lazer'),
  ('Piscina', 'piscina')
on conflict (slug) do nothing;
