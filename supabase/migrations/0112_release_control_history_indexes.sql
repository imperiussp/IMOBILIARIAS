-- Indices operacionais dos controles de homologacao/lancamento.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

create index if not exists platform_release_control_history_changed_at_idx
  on public.platform_release_control_history(changed_at desc);

create index if not exists platform_release_control_history_changed_by_idx
  on public.platform_release_control_history(changed_by,changed_at desc)
  where changed_by is not null;

comment on index public.platform_release_control_history_changed_at_idx is
'Leitura eficiente do historico recente de controles globais da plataforma.';
