-- Keep platform-managed subdomains internally consistent.
-- Platform domains are created verified by the onboarding flow, so their
-- verification_status must agree with verified=true from the first insert.

create or replace function public.normalize_platform_domain_insert_state()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.kind = 'platform' and new.verified = true then
    new.verification_status := 'verified';
    new.verified_at := coalesce(new.verified_at, now());
    new.verification_error := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists agency_domains_platform_insert_state on public.agency_domains;
create trigger agency_domains_platform_insert_state
before insert on public.agency_domains
for each row execute function public.normalize_platform_domain_insert_state();

-- Existing platform domains created before this consistency guard may have
-- verified=true with a stale pending status. The platform owns these fields;
-- temporarily disable only the protective update trigger for this controlled
-- data repair, then restore it immediately.
alter table public.agency_domains disable trigger agency_domains_protect_verification;

update public.agency_domains
set verification_status = 'verified',
    verified_at = coalesce(verified_at, now()),
    verification_error = null
where kind = 'platform'
  and verified = true
  and verification_status is distinct from 'verified';

alter table public.agency_domains enable trigger agency_domains_protect_verification;
