-- Convites de equipe por imobiliária.
-- O token bruto nunca fica armazenado: somente o hash SHA-256 é persistido.

create table if not exists public.agency_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','broker','staff')),
  broker_id uuid references public.brokers(id) on delete set null,
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agency_invitations_agency_idx
on public.agency_invitations (agency_id, created_at desc);

create unique index if not exists agency_invitations_pending_email_idx
on public.agency_invitations (agency_id, lower(email))
where accepted_at is null and revoked_at is null;

alter table public.agency_invitations enable row level security;

create policy "tenant managers read own invitations" on public.agency_invitations
for select to authenticated
using (public.can_manage_agency(agency_id));

create policy "platform admins manage invitations" on public.agency_invitations
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.create_agency_invitation(
  p_agency_id uuid,
  p_email text,
  p_role text,
  p_broker_id uuid default null
)
returns table (invitation_id uuid, invitation_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  normalized_email text;
  raw_token text;
  new_id uuid;
  new_expiry timestamptz;
begin
  normalized_email := lower(trim(p_email));
  if normalized_email = '' or position('@' in normalized_email) <= 1 then
    raise exception 'Informe um e-mail válido.';
  end if;

  select am.role into caller_role
  from public.agency_memberships am
  where am.agency_id = p_agency_id
    and am.user_id = auth.uid()
    and am.active = true
  limit 1;

  if not public.is_platform_admin() and caller_role not in ('owner','admin') then
    raise exception 'Acesso negado.';
  end if;

  if p_role not in ('admin','broker','staff') then
    raise exception 'Perfil inválido.';
  end if;

  if p_role = 'admin' and not public.is_platform_admin() and caller_role <> 'owner' then
    raise exception 'Somente o proprietário pode convidar outro administrador.';
  end if;

  if p_role = 'broker' then
    if p_broker_id is null then
      raise exception 'Selecione o corretor que será vinculado ao convite.';
    end if;
    if not exists (
      select 1 from public.brokers b
      where b.id = p_broker_id and b.agency_id = p_agency_id and b.active = true
    ) then
      raise exception 'Corretor inválido para esta imobiliária.';
    end if;
  elsif p_broker_id is not null then
    raise exception 'Vínculo de corretor só pode ser usado em convite de corretor.';
  end if;

  if not public.agency_can_add_member(p_agency_id) then
    raise exception 'Limite de usuários do plano atingido.';
  end if;

  update public.agency_invitations
  set revoked_at = now()
  where agency_id = p_agency_id
    and lower(email) = normalized_email
    and accepted_at is null
    and revoked_at is null;

  raw_token := encode(gen_random_bytes(24), 'hex');
  new_expiry := now() + interval '7 days';

  insert into public.agency_invitations (
    agency_id, email, role, broker_id, token_hash, invited_by, expires_at
  ) values (
    p_agency_id, normalized_email, p_role, p_broker_id,
    encode(digest(raw_token, 'sha256'), 'hex'), auth.uid(), new_expiry
  ) returning id into new_id;

  return query select new_id, raw_token, new_expiry;
end;
$$;

create or replace function public.accept_agency_invitation(p_token text)
returns table (agency_id uuid, agency_name text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.agency_invitations%rowtype;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Faça login para aceitar o convite.';
  end if;

  select lower(email) into user_email from auth.users where id = auth.uid();

  select i.* into invitation
  from public.agency_invitations i
  where i.token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  limit 1;

  if not found then
    raise exception 'Convite inválido ou expirado.';
  end if;

  if user_email is null or lower(invitation.email) <> user_email then
    raise exception 'Este convite foi enviado para outro e-mail.';
  end if;

  insert into public.agency_memberships (agency_id, user_id, role, active)
  values (invitation.agency_id, auth.uid(), invitation.role, true)
  on conflict (agency_id, user_id)
  do update set role = excluded.role, active = true;

  if invitation.role = 'broker' and invitation.broker_id is not null then
    update public.brokers
    set user_id = null
    where agency_id = invitation.agency_id
      and user_id = auth.uid()
      and id <> invitation.broker_id;

    update public.brokers
    set user_id = auth.uid()
    where id = invitation.broker_id
      and agency_id = invitation.agency_id
      and active = true;
  end if;

  update public.agency_invitations
  set accepted_at = now()
  where id = invitation.id;

  return query
  select a.id, a.name, invitation.role
  from public.agencies a
  where a.id = invitation.agency_id;
end;
$$;

create or replace function public.revoke_agency_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_agency uuid;
begin
  select agency_id into target_agency
  from public.agency_invitations
  where id = p_invitation_id;

  if target_agency is null or not public.can_manage_agency(target_agency) then
    raise exception 'Acesso negado.';
  end if;

  update public.agency_invitations
  set revoked_at = now()
  where id = p_invitation_id and accepted_at is null;
end;
$$;

revoke all on function public.create_agency_invitation(uuid,text,text,uuid) from public;
revoke all on function public.accept_agency_invitation(text) from public;
revoke all on function public.revoke_agency_invitation(uuid) from public;
grant execute on function public.create_agency_invitation(uuid,text,text,uuid) to authenticated;
grant execute on function public.accept_agency_invitation(text) to authenticated;
grant execute on function public.revoke_agency_invitation(uuid) to authenticated;
