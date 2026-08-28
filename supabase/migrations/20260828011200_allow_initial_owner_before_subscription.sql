-- O proprietário precisa ser criado junto com a imobiliária antes da escolha/pagamento do plano.
-- O limite de usuários continua valendo para qualquer membro adicional.
create or replace function public.enforce_membership_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform_admin() then
    return new;
  end if;

  -- Primeiro proprietário da imobiliária: permite concluir o cadastro mesmo sem
  -- assinatura ativa. O acesso operacional continua controlado pelo billing gate.
  if tg_op = 'INSERT'
     and new.active = true
     and new.role = 'owner'
     and not exists (
       select 1
       from public.agency_memberships am
       where am.agency_id = new.agency_id
         and am.role = 'owner'
         and am.active = true
     ) then
    return new;
  end if;

  if new.active = true
     and (
       tg_op = 'INSERT'
       or old.active = false
       or old.agency_id is distinct from new.agency_id
     ) then
    if not public.agency_can_add_member(new.agency_id) then
      raise exception 'Limite de usuários do plano atingido. Atualize o plano para adicionar novos membros.';
    end if;
  end if;

  return new;
end;
$$;
