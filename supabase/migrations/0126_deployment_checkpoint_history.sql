-- Histórico auditável dos checkpoints de implantação.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create table if not exists public.platform_deployment_checkpoint_history (
  id uuid primary key default gen_random_uuid(),
  checkpoint_key text not null,
  previous_completed boolean,
  current_completed boolean not null,
  previous_notes text,
  current_notes text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists platform_deployment_checkpoint_history_key_idx
  on public.platform_deployment_checkpoint_history(checkpoint_key,changed_at desc);
create index if not exists platform_deployment_checkpoint_history_changed_idx
  on public.platform_deployment_checkpoint_history(changed_at desc);

alter table public.platform_deployment_checkpoint_history enable row level security;

drop policy if exists "platform admins read deployment checkpoint history" on public.platform_deployment_checkpoint_history;
create policy "platform admins read deployment checkpoint history"
on public.platform_deployment_checkpoint_history
for select to authenticated
using (public.is_platform_admin());

create or replace function public.capture_platform_deployment_checkpoint_history()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.completed is distinct from new.completed or old.notes is distinct from new.notes then
    insert into public.platform_deployment_checkpoint_history(
      checkpoint_key,previous_completed,current_completed,previous_notes,current_notes,changed_by
    ) values (
      new.checkpoint_key,old.completed,new.completed,old.notes,new.notes,auth.uid()
    );
  end if;
  return new;
end;
$$;
revoke all on function public.capture_platform_deployment_checkpoint_history() from public,anon,authenticated;

drop trigger if exists platform_deployment_checkpoint_history_capture on public.platform_deployment_checkpoints;
create trigger platform_deployment_checkpoint_history_capture
after update on public.platform_deployment_checkpoints
for each row execute function public.capture_platform_deployment_checkpoint_history();

comment on table public.platform_deployment_checkpoint_history is 'Auditoria append-only das confirmações e observações da implantação.';
