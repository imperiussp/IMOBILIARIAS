-- Defense in depth: estas tabelas sao internas e nao devem ser acessiveis por clientes.
-- anon/authenticated ja nao possuem grants; as policies abaixo tornam a negacao explicita no RLS.

create policy "deny client access to inbound email events"
on public.inbound_email_events
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny client access to platform maintenance auth"
on public.platform_maintenance_auth
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny client access to platform owner bootstrap tokens"
on public.platform_owner_bootstrap_tokens
for all
to anon, authenticated
using (false)
with check (false);
