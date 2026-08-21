-- Regras finais de integridade e segurança para produção.

-- Contatos públicos não podem escolher arbitrariamente um corretor.
-- Quando há imóvel, o corretor deve ser o responsável pelo imóvel; quando não há,
-- o contato permanece geral e sem corretor pré-definido.
drop policy if exists "public create valid leads" on public.leads;
create policy "public create valid leads" on public.leads
for insert to anon, authenticated
with check (
  (
    property_id is null
    and broker_id is null
  )
  or exists (
    select 1
    from public.properties p
    where p.id = property_id
      and p.publication_state = 'published'
      and p.status in ('available', 'reserved', 'rented', 'sold')
      and (broker_id is null or broker_id = p.broker_id)
  )
);

-- Imóvel alugado ou vendido vira histórico operacional e não pode ser apagado.
create or replace function public.prevent_closed_property_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('rented', 'sold') then
    raise exception 'Imóveis alugados ou vendidos não podem ser excluídos. Altere o status ou mantenha o registro para histórico.';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_closed_property_delete_trigger on public.properties;
create trigger prevent_closed_property_delete_trigger
before delete on public.properties
for each row execute function public.prevent_closed_property_delete();

-- Helper único para conferir corretor autenticado e ativo.
create or replace function public.is_active_broker()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brokers b
    where b.user_id = auth.uid()
      and b.active = true
  );
$$;

grant execute on function public.is_active_broker() to authenticated;
