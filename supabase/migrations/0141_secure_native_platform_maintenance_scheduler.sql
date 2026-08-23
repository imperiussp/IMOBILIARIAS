create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.platform_maintenance_auth (
  id smallint primary key default 1 check (id = 1),
  secret_hash text not null,
  rotated_at timestamptz not null default now()
);

alter table public.platform_maintenance_auth enable row level security;
revoke all on public.platform_maintenance_auth from public, anon, authenticated;

create or replace function public.verify_platform_maintenance_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_maintenance_auth
    where id = 1
      and secret_hash = encode(extensions.digest(coalesce(p_secret,''), 'sha256'), 'hex')
  );
$$;

revoke all on function public.verify_platform_maintenance_secret(text) from public, anon, authenticated;
grant execute on function public.verify_platform_maintenance_secret(text) to service_role;

do $$
declare
  v_secret text;
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'platform_maintenance_cron_secret'
  ) then
    v_secret := encode(extensions.gen_random_bytes(32), 'hex');

    insert into public.platform_maintenance_auth(id, secret_hash, rotated_at)
    values (1, encode(extensions.digest(v_secret, 'sha256'), 'hex'), now())
    on conflict (id) do update
      set secret_hash = excluded.secret_hash,
          rotated_at = excluded.rotated_at;

    perform vault.create_secret(
      v_secret,
      'platform_maintenance_cron_secret',
      'Secret generated internally for pg_cron -> platform-maintenance authentication',
      null
    );
  end if;
end
$$;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'lenoy-platform-maintenance-hourly'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end
$$;

select cron.schedule(
  'lenoy-platform-maintenance-hourly',
  '17 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rvjsonspplqelktzwusu.supabase.co/functions/v1/platform-maintenance',
    headers := jsonb_build_object(
      'content-type','application/json',
      'x-platform-maintenance-secret',(
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'platform_maintenance_cron_secret'
        order by created_at desc
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);