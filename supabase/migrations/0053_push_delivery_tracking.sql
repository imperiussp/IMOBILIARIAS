-- Controle de entrega remota das notificações do aplicativo.

alter table public.app_notifications
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_attempts integer not null default 0,
  add column if not exists push_last_error text;

create index if not exists app_notifications_pending_push_idx
on public.app_notifications (created_at)
where push_sent_at is null;

-- O cliente não altera o estado de entrega push; somente o backend/service role.
create or replace function public.protect_notification_delivery_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.push_sent_at := old.push_sent_at;
    new.push_attempts := old.push_attempts;
    new.push_last_error := old.push_last_error;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_notification_delivery_fields() from public;

drop trigger if exists app_notifications_protect_delivery on public.app_notifications;
create trigger app_notifications_protect_delivery
before update on public.app_notifications
for each row execute function public.protect_notification_delivery_fields();
