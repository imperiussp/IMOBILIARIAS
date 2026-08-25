-- Controle de dispositivos ativos por usuário.
-- Regra comercial: cada usuário pode manter no máximo 2 dispositivos ativos.

create table if not exists public.user_device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_label text not null default 'Dispositivo',
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_id),
  check (char_length(device_id) between 8 and 160),
  check (char_length(device_label) between 1 and 160)
);

create index if not exists user_device_sessions_active_idx
  on public.user_device_sessions (user_id, last_seen_at desc)
  where revoked_at is null;

alter table public.user_device_sessions enable row level security;

-- A tabela não é exposta diretamente ao cliente. O acesso passa pelas RPCs abaixo.
revoke all on table public.user_device_sessions from anon, authenticated;

create or replace function public.register_user_device(
  p_device_id text,
  p_device_label text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_id text := trim(coalesce(p_device_id, ''));
  v_label text := left(trim(coalesce(nullif(p_device_label, ''), 'Dispositivo')), 160);
  v_agent text := left(coalesce(p_user_agent, ''), 1000);
  v_existing public.user_device_sessions%rowtype;
  v_active_count integer;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;
  if char_length(v_device_id) < 8 or char_length(v_device_id) > 160 then
    raise exception 'Identificador de dispositivo inválido';
  end if;

  -- Serializa tentativas simultâneas do mesmo usuário.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_existing
  from public.user_device_sessions
  where user_id = v_user_id and device_id = v_device_id;

  select count(*) into v_active_count
  from public.user_device_sessions
  where user_id = v_user_id and revoked_at is null;

  if found and v_existing.revoked_at is null then
    update public.user_device_sessions
      set device_label = v_label,
          user_agent = v_agent,
          last_seen_at = now()
    where id = v_existing.id;

    return jsonb_build_object(
      'allowed', true,
      'max_devices', 2,
      'active_count', v_active_count,
      'session_id', v_existing.id
    );
  end if;

  if v_active_count < 2 then
    insert into public.user_device_sessions (user_id, device_id, device_label, user_agent, revoked_at, last_seen_at)
    values (v_user_id, v_device_id, v_label, v_agent, null, now())
    on conflict (user_id, device_id) do update
      set device_label = excluded.device_label,
          user_agent = excluded.user_agent,
          revoked_at = null,
          last_seen_at = now();

    return jsonb_build_object(
      'allowed', true,
      'max_devices', 2,
      'active_count', v_active_count + 1,
      'session_id', (select id from public.user_device_sessions where user_id = v_user_id and device_id = v_device_id)
    );
  end if;

  return jsonb_build_object(
    'allowed', false,
    'max_devices', 2,
    'active_count', v_active_count,
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', uds.id,
        'label', uds.device_label,
        'last_seen_at', uds.last_seen_at,
        'created_at', uds.created_at
      ) order by uds.last_seen_at desc)
      from public.user_device_sessions uds
      where uds.user_id = v_user_id and uds.revoked_at is null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.revoke_user_device(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.user_device_sessions
    set revoked_at = now()
  where id = p_session_id
    and user_id = auth.uid()
    and revoked_at is null;

  return found;
end;
$$;

create or replace function public.touch_user_device(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_device_sessions%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  select * into v_row
  from public.user_device_sessions
  where user_id = auth.uid() and device_id = trim(coalesce(p_device_id, ''));

  if not found or v_row.revoked_at is not null then
    return jsonb_build_object('allowed', false, 'reason', 'revoked_or_missing');
  end if;

  update public.user_device_sessions
    set last_seen_at = now()
  where id = v_row.id;

  return jsonb_build_object('allowed', true, 'session_id', v_row.id, 'max_devices', 2);
end;
$$;

create or replace function public.release_user_device(p_device_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.user_device_sessions
    set revoked_at = now()
  where user_id = auth.uid()
    and device_id = trim(coalesce(p_device_id, ''))
    and revoked_at is null;

  return found;
end;
$$;

revoke all on function public.register_user_device(text,text,text) from public;
revoke all on function public.revoke_user_device(uuid) from public;
revoke all on function public.touch_user_device(text) from public;
revoke all on function public.release_user_device(text) from public;
grant execute on function public.register_user_device(text,text,text) to authenticated;
grant execute on function public.revoke_user_device(uuid) to authenticated;
grant execute on function public.touch_user_device(text) to authenticated;
grant execute on function public.release_user_device(text) to authenticated;
