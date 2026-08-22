-- Checklist documental por imóvel.
-- EXCLUSIVO do Supabase IMOBILIARIAS. Não aplicar no Moto Connect.

create table if not exists public.property_document_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  item_key text not null,
  label text not null,
  status text not null default 'pending' check (status in ('pending','received','approved','rejected','not_applicable')),
  expires_at date,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id,item_key)
);

create index if not exists property_document_items_agency_status_idx on public.property_document_items(agency_id,status,updated_at desc);
alter table public.property_document_items enable row level security;

drop policy if exists "tenant members manage property documents" on public.property_document_items;
create policy "tenant members manage property documents" on public.property_document_items
for all to authenticated
using (public.is_agency_member(agency_id) or public.is_platform_admin())
with check (public.is_agency_member(agency_id) or public.is_platform_admin());

create or replace function public.validate_property_document_item_tenant()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.properties p where p.id=new.property_id and p.agency_id=new.agency_id) then raise exception 'Imóvel fora da imobiliária atual.'; end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(),new.updated_by);
  return new;
end; $$;
revoke all on function public.validate_property_document_item_tenant() from public,anon,authenticated;

drop trigger if exists property_document_items_validate on public.property_document_items;
create trigger property_document_items_validate before insert or update on public.property_document_items
for each row execute function public.validate_property_document_item_tenant();

create or replace function public.ensure_default_property_document_items(p_property_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_agency uuid;
begin
  select agency_id into v_agency from public.properties where id=p_property_id;
  if v_agency is null then raise exception 'Imóvel não encontrado.'; end if;
  if not (public.is_agency_member(v_agency) or public.is_platform_admin()) then raise exception 'Sem acesso.'; end if;
  insert into public.property_document_items(agency_id,property_id,item_key,label)
  values
    (v_agency,p_property_id,'matricula','Matrícula atualizada'),
    (v_agency,p_property_id,'iptu','IPTU / cadastro municipal'),
    (v_agency,p_property_id,'proprietario','Documento do proprietário'),
    (v_agency,p_property_id,'endereco','Comprovante de endereço'),
    (v_agency,p_property_id,'onus','Certidão de ônus / gravames'),
    (v_agency,p_property_id,'condominio','Declaração / situação condominial'),
    (v_agency,p_property_id,'autorizacao','Autorização de intermediação')
  on conflict (property_id,item_key) do nothing;
end; $$;
revoke all on function public.ensure_default_property_document_items(uuid) from public,anon;
grant execute on function public.ensure_default_property_document_items(uuid) to authenticated;

create or replace view public.agency_property_document_summary as
select agency_id,property_id,
  count(*)::bigint as total,
  count(*) filter(where status='approved')::bigint as approved,
  count(*) filter(where status='pending')::bigint as pending,
  count(*) filter(where status='rejected')::bigint as rejected,
  count(*) filter(where expires_at is not null and expires_at < current_date)::bigint as expired,
  count(*) filter(where expires_at between current_date and current_date+30)::bigint as expires_30d
from public.property_document_items
group by agency_id,property_id;
revoke all on public.agency_property_document_summary from public,anon;
grant select on public.agency_property_document_summary to authenticated;
