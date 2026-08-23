create or replace function public.normalize_property_photo_cover(target_property_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  chosen_id uuid;
  target_agency_id uuid;
begin
  if target_property_id is null then return; end if;

  select p.agency_id into target_agency_id
  from public.properties p
  where p.id = target_property_id;

  if target_agency_id is null then return; end if;

  if auth.uid() is not null
     and pg_trigger_depth() = 0
     and not public.can_access_property_internal(target_agency_id, target_property_id)
     and not public.is_platform_admin() then
    raise exception 'Acesso negado';
  end if;

  select id into chosen_id
  from public.property_photos
  where property_id = target_property_id
  order by is_cover desc, position asc, created_at asc
  limit 1;

  if chosen_id is null then return; end if;

  update public.property_photos
  set is_cover = (id = chosen_id)
  where property_id = target_property_id
    and is_cover is distinct from (id = chosen_id);
end;
$function$;

revoke all on function public.normalize_property_photo_cover(uuid) from public, anon;
grant execute on function public.normalize_property_photo_cover(uuid) to authenticated, service_role;

create index if not exists agency_invitations_invited_by_idx on public.agency_invitations(invited_by);
create index if not exists agency_subscriptions_plan_id_idx on public.agency_subscriptions(plan_id);
create index if not exists ai_usage_events_user_id_idx on public.ai_usage_events(user_id);
create index if not exists billing_checkout_sessions_plan_id_idx on public.billing_checkout_sessions(plan_id);
create index if not exists lead_activity_events_actor_user_id_idx on public.lead_activity_events(actor_user_id);
create index if not exists lead_followups_created_by_idx on public.lead_followups(created_by);
create index if not exists lead_notes_created_by_idx on public.lead_notes(created_by);
create index if not exists property_visit_appointments_created_by_idx on public.property_visit_appointments(created_by);
