-- Remove índice duplicado identificado pelo advisor de performance do Supabase.
-- leads_broker_status_created_idx já cobre exatamente as mesmas colunas.
DROP INDEX IF EXISTS public.leads_broker_status_idx;
