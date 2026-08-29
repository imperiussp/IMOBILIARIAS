-- Shared client test environment: full premium access except AI, with automatic reset.

create table if not exists public.test_client_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid not null unique references public.agencies(id) on delete cascade,
  username text not null unique,
  reset_after interval not null default interval '2 hours',
  last_reset_at timestamptz not null default now(),
  enabled boolean not null default true,
  baseline_agency jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_client_accounts_username_check check (username ~ '^[a-z0-9._-]{3,40}$'),
  constraint test_client_accounts_reset_after_check check (reset_after >= interval '30 minutes' and reset_after <= interval '24 hours')
);

alter table public.test_client_accounts enable row level security;
revoke all on public.test_client_accounts from anon, authenticated;

insert into public.subscription_plans (
  code, name, monthly_price, annual_price, max_properties, max_users,
  max_ai_descriptions, features, active, display_order
)
values (
  'teste_premium',
  'Premium demonstração',
  0,
  0,
  100000,
  1000,
  0,
  jsonb_build_object(
    'ai_descriptions', false,
    'auto_buyer_outreach', false,
    'custom_domain', true,
    'custom_email', true,
    'professional_email', true,
    'document_templates', true,
    'document_center', true,
    'advanced_reports', true,
    'custom_branding', true,
    'priority_support', true,
    'unlimited_documents', true,
    'captacao_externa', true
  ),
  false,
  999
)
on conflict (code) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  max_properties = excluded.max_properties,
  max_users = excluded.max_users,
  max_ai_descriptions = excluded.max_ai_descriptions,
  features = excluded.features,
  active = false,
  display_order = excluded.display_order;

create or replace function public.test_client_mode_status()
returns table(
  is_test boolean,
  username text,
  agency_id uuid,
  reset_minutes integer,
  last_reset_at timestamptz,
  next_reset_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    true,
    t.username,
    t.agency_id,
    greatest(1, floor(extract(epoch from t.reset_after) / 60)::integer),
    t.last_reset_at,
    t.last_reset_at + t.reset_after
  from public.test_client_accounts t
  where t.user_id = auth.uid()
    and t.enabled = true
  limit 1;
$$;

revoke all on function public.test_client_mode_status() from public;
grant execute on function public.test_client_mode_status() to authenticated;

create or replace function public.reset_due_test_client_accounts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_row public.test_client_accounts%rowtype;
  table_row record;
  reset_count integer := 0;
  pass integer;
begin
  for account_row in
    select *
    from public.test_client_accounts
    where enabled = true
      and last_reset_at + reset_after <= now()
    for update skip locked
  loop
    -- Remove user-specific favorites first; property rows also cascade to favorites.
    delete from public.favorites
    where user_id = account_row.user_id;

    -- Preserve only the shared owner's membership and broker profile.
    delete from public.agency_memberships
    where agency_id = account_row.agency_id
      and user_id <> account_row.user_id;

    delete from public.brokers
    where agency_id = account_row.agency_id
      and user_id is distinct from account_row.user_id;

    -- Delete every tenant-scoped operational/configuration row while preserving
    -- the few rows required for the shared account, domain and paid-access gate.
    for pass in 1..8 loop
      for table_row in
        select t.table_name
        from information_schema.tables t
        where t.table_schema = 'public'
          and t.table_type = 'BASE TABLE'
          and exists (
            select 1
            from information_schema.columns c
            where c.table_schema = 'public'
              and c.table_name = t.table_name
              and c.column_name = 'agency_id'
          )
          and t.table_name not in (
            'agencies',
            'agency_domains',
            'agency_memberships',
            'agency_subscriptions',
            'agency_billing_profiles',
            'agency_billing_discounts',
            'billing_checkout_sessions',
            'billing_customers',
            'billing_events',
            'prepaid_purchase_intents',
            'brokers',
            'test_client_accounts'
          )
        order by t.table_name
      loop
        begin
          execute format('delete from public.%I where agency_id = $1', table_row.table_name)
          using account_row.agency_id;
        exception
          when foreign_key_violation then
            null;
        end;
      end loop;
    end loop;

    -- Restore the visible agency identity to the clean demonstration baseline.
    update public.agencies
    set
      name = coalesce(account_row.baseline_agency->>'name', 'Imobiliária Demonstração'),
      tagline = nullif(account_row.baseline_agency->>'tagline', ''),
      phone = nullif(account_row.baseline_agency->>'phone', ''),
      whatsapp = nullif(account_row.baseline_agency->>'whatsapp', ''),
      email = nullif(account_row.baseline_agency->>'email', ''),
      address = nullif(account_row.baseline_agency->>'address', ''),
      company_creci = nullif(account_row.baseline_agency->>'company_creci', ''),
      logo_url = nullif(account_row.baseline_agency->>'logo_url', ''),
      primary_color = coalesce(nullif(account_row.baseline_agency->>'primary_color', ''), '#17202a'),
      secondary_color = coalesce(nullif(account_row.baseline_agency->>'secondary_color', ''), '#d6ac58'),
      background_color = coalesce(nullif(account_row.baseline_agency->>'background_color', ''), '#f7f8fa'),
      text_color = coalesce(nullif(account_row.baseline_agency->>'text_color', ''), '#18212b'),
      theme_preset = coalesce(nullif(account_row.baseline_agency->>'theme_preset', ''), 'classic'),
      button_style = coalesce(nullif(account_row.baseline_agency->>'button_style', ''), 'rounded'),
      instagram_url = nullif(account_row.baseline_agency->>'instagram_url', ''),
      facebook_url = nullif(account_row.baseline_agency->>'facebook_url', ''),
      youtube_url = nullif(account_row.baseline_agency->>'youtube_url', ''),
      hero_background_url = nullif(account_row.baseline_agency->>'hero_background_url', ''),
      updated_at = now()
    where id = account_row.agency_id;

    update public.brokers
    set
      name = 'Usuário Teste',
      photo_url = null,
      phone = null,
      whatsapp = null,
      email = 'teste@demo.imoveis.lenoy.com.br',
      creci = null,
      active = true,
      area_of_operation = null,
      address = null,
      updated_at = now()
    where agency_id = account_row.agency_id
      and user_id = account_row.user_id;

    update public.test_client_accounts
    set last_reset_at = now(), updated_at = now()
    where user_id = account_row.user_id;

    reset_count := reset_count + 1;
  end loop;

  return reset_count;
end;
$$;

revoke all on function public.reset_due_test_client_accounts() from public;

-- The scheduler only checks whether a two-hour reset is due; it does not shorten
-- the two-hour test window. Five-minute polling keeps the reset prompt and cheap.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'lenoy-test-client-reset'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'lenoy-test-client-reset',
    '*/5 * * * *',
    'select public.reset_due_test_client_accounts();'
  );
end;
$$;
