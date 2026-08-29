-- Mantém um catálogo base permanente no ambiente de cliente teste.
-- O reset periódico remove alterações feitas pelo usuário teste e restaura
-- os imóveis/fotos gravados como baseline.

alter table public.test_client_accounts
  add column if not exists baseline_properties jsonb not null default '[]'::jsonb,
  add column if not exists baseline_property_photos jsonb not null default '[]'::jsonb;

create or replace function public.agency_can_create_property(p_agency_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  with test_client as (
    select exists(
      select 1
      from public.test_client_accounts t
      where t.agency_id = p_agency_id
        and t.enabled = true
    ) as allowed
  ), history as (
    select exists(
      select 1 from public.agency_subscriptions s where s.agency_id=p_agency_id
    ) as has_history
  ), current_plan as (
    select p.max_properties
    from public.agency_subscriptions s
    join public.subscription_plans p on p.id=s.plan_id
    where s.agency_id=p_agency_id
      and s.status in ('trial','active','past_due')
      and (s.ends_at is null or s.ends_at>now())
      and p.active=true
    order by s.starts_at desc
    limit 1
  )
  select case
    when (select allowed from test_client) then true
    when not (select has_history from history) then true
    when not exists(select 1 from current_plan) then false
    else (
      select cp.max_properties is null
        or (select count(*) from public.properties pr where pr.agency_id=p_agency_id and pr.status<>'inactive') < cp.max_properties
      from current_plan cp
    )
  end
$function$;

create or replace function public.reset_due_test_client_accounts()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
    delete from public.favorites
    where user_id = account_row.user_id;

    delete from public.agency_memberships
    where agency_id = account_row.agency_id
      and user_id <> account_row.user_id;

    delete from public.brokers
    where agency_id = account_row.agency_id
      and user_id is distinct from account_row.user_id;

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

    if jsonb_typeof(account_row.baseline_properties) = 'array'
       and jsonb_array_length(account_row.baseline_properties) > 0 then
      insert into public.properties (
        id, code, broker_id, city_id, neighborhood_id, property_type_id,
        title, slug, description, purpose, zone, status, price,
        bedrooms, suites, bathrooms, parking_spaces, built_area_m2, land_area_m2,
        address, address_public, latitude, longitude, featured, published_at,
        created_at, updated_at, segment, publication_state, agency_id,
        display_code, marketing_label, financing_accepted
      )
      select
        p.id, p.code, p.broker_id, p.city_id, p.neighborhood_id, p.property_type_id,
        p.title, p.slug, p.description, p.purpose, p.zone, p.status, p.price,
        p.bedrooms, p.suites, p.bathrooms, p.parking_spaces, p.built_area_m2, p.land_area_m2,
        p.address, p.address_public, p.latitude, p.longitude, p.featured, p.published_at,
        p.created_at, p.updated_at, p.segment, p.publication_state, p.agency_id,
        p.display_code, p.marketing_label, p.financing_accepted
      from jsonb_populate_recordset(null::public.properties, account_row.baseline_properties) as p;
    end if;

    if jsonb_typeof(account_row.baseline_property_photos) = 'array'
       and jsonb_array_length(account_row.baseline_property_photos) > 0 then
      insert into public.property_photos (
        id, property_id, storage_path, thumbnail_path, alt_text, position, is_cover, created_at
      )
      select
        ph.id, ph.property_id, ph.storage_path, ph.thumbnail_path, ph.alt_text, ph.position, ph.is_cover, ph.created_at
      from jsonb_populate_recordset(null::public.property_photos, account_row.baseline_property_photos) as ph;
    end if;

    update public.test_client_accounts
    set last_reset_at = now(), updated_at = now()
    where user_id = account_row.user_id;

    reset_count := reset_count + 1;
  end loop;

  return reset_count;
end;
$function$;
