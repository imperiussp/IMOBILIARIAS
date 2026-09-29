-- Garante que somente a imobiliária oficial de demonstração possa existir
-- em test_client_accounts. Cadastros feitos pelo painel administrativo nunca
-- podem ser tratados como ambiente de teste.

delete from public.test_client_accounts t
using auth.users u, public.agencies a
where t.user_id = u.id
  and t.agency_id = a.id
  and (
    coalesce(u.raw_user_meta_data->>'onboarding_kind','') = 'platform_admin_created'
    or lower(coalesce(u.email,'')) <> 'teste@demo.imoveis.lenoy.com.br'
    or lower(coalesce(a.slug,'')) <> 'teste'
    or lower(coalesce(t.username,'')) <> 'teste'
    or coalesce((u.raw_user_meta_data->>'test_client')::boolean, false) is not true
  );

create or replace function public.enforce_single_designated_test_client()
returns trigger
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  v_email text;
  v_slug text;
  v_test_flag boolean := false;
  v_onboarding_kind text;
begin
  select lower(coalesce(email,'')),
         coalesce((raw_user_meta_data->>'test_client')::boolean, false),
         coalesce(raw_user_meta_data->>'onboarding_kind','')
    into v_email, v_test_flag, v_onboarding_kind
  from auth.users
  where id = new.user_id;

  select lower(coalesce(slug,''))
    into v_slug
  from public.agencies
  where id = new.agency_id;

  if lower(coalesce(new.username,'')) <> 'teste'
     or v_email <> 'teste@demo.imoveis.lenoy.com.br'
     or v_slug <> 'teste'
     or v_test_flag is not true
     or v_onboarding_kind = 'platform_admin_created' then
    raise exception 'Somente a imobiliária de demonstração oficial pode ser marcada como cliente teste';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_single_designated_test_client
  on public.test_client_accounts;

create trigger trg_enforce_single_designated_test_client
before insert or update on public.test_client_accounts
for each row
execute function public.enforce_single_designated_test_client();

revoke all on function public.enforce_single_designated_test_client() from public;
