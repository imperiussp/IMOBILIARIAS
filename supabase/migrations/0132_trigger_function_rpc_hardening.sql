-- Remove acesso RPC direto de funções SECURITY DEFINER usadas exclusivamente por triggers.
-- Os triggers continuam executando normalmente; o objetivo é reduzir a superfície exposta pela Data API.
-- EXCLUSIVO do Supabase IMOBILIARIAS.

revoke execute on function public.assign_lead_broker() from authenticated;
revoke execute on function public.enforce_membership_plan_limit() from authenticated;
revoke execute on function public.enforce_property_plan_limit() from authenticated;
revoke execute on function public.ensure_property_photo_cover() from authenticated;
revoke execute on function public.handle_new_user_profile() from authenticated;
revoke execute on function public.log_broker_changes() from authenticated;
revoke execute on function public.log_property_changes() from authenticated;
revoke execute on function public.record_lead_qualification_history() from authenticated;
revoke execute on function public.restore_property_photo_cover_after_delete() from authenticated;

comment on function public.assign_lead_broker() is 'Função interna de trigger; chamada RPC direta revogada.';
comment on function public.enforce_membership_plan_limit() is 'Função interna de trigger; chamada RPC direta revogada.';
comment on function public.enforce_property_plan_limit() is 'Função interna de trigger; chamada RPC direta revogada.';
comment on function public.ensure_property_photo_cover() is 'Função interna de trigger; chamada RPC direta revogada.';
comment on function public.handle_new_user_profile() is 'Função interna de trigger; chamada RPC direta revogada.';
comment on function public.log_broker_changes() is 'Função interna de trigger; chamada RPC direta revogada.';
comment on function public.log_property_changes() is 'Função interna de trigger; chamada RPC direta revogada.';
comment on function public.record_lead_qualification_history() is 'Função interna de trigger; chamada RPC direta revogada.';
comment on function public.restore_property_photo_cover_after_delete() is 'Função interna de trigger; chamada RPC direta revogada.';
