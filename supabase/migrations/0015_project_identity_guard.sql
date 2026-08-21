create or replace function public.project_identity()
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select 'IMOBILIARIAS'::text;
$$;

grant execute on function public.project_identity() to anon, authenticated;
