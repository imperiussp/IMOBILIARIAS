-- Ensure every tenant has a usable baseline property taxonomy.
-- Global types are readable by all authenticated tenants and by the public catalog.

insert into public.property_types (name, slug, active, agency_id)
values
  ('Apartamento','apartamento',true,null),
  ('Casa','casa',true,null),
  ('Sobrado','sobrado',true,null),
  ('Kitnet / Studio','kitnet-studio',true,null),
  ('Terreno','terreno',true,null),
  ('Chácara / Sítio','chacara-sitio',true,null),
  ('Fazenda','fazenda',true,null),
  ('Sala comercial','sala-comercial',true,null),
  ('Loja','loja',true,null),
  ('Galpão','galpao',true,null),
  ('Prédio comercial','predio-comercial',true,null),
  ('Área industrial','area-industrial',true,null)
on conflict do nothing;
