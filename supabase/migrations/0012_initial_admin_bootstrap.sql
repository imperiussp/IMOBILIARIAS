create or replace function public.initial_admin_available()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.user_roles);
$$;

create or replace function public.claim_initial_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Faça login primeiro';
  end if;

  if exists (select 1 from public.user_roles) then
    raise exception 'O administrador inicial já foi definido';
  end if;

  insert into public.user_roles (user_id, role)
  values (auth.uid(), 'admin')
  on conflict (user_id) do update set role = 'admin';
end;
$$;

grant execute on function public.initial_admin_available() to authenticated;
grant execute on function public.claim_initial_admin() to authenticated;
