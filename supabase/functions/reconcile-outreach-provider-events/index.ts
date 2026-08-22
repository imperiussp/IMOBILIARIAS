import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const maintenanceSecret=Deno.env.get("PLATFORM_MAINTENANCE_SECRET")||"";

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8"}});}
function clean(value:unknown,max=1200){return String(value??"").trim().slice(0,max);}
function normalizeText(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();}
function classifyResponse(text:string){const value=normalizeText(text);if(!value)return"reply";const opt=["nao quero receber","nao me envie mais","pare de enviar","pare de mandar","parar de receber","cancelar mensagens","remover meu numero","sair da lista","descadastrar","unsubscribe"];if(opt.some(t=>value.includes(normalizeText(t))))return"opt_out";if(["quero visitar","agendar visita","marcar visita","visitar o imovel"].some(t=>value.includes(normalizeText(t))))return"request_visit";if(["mais detalhes","mais informacoes","quero saber mais","me passa os detalhes"].some(t=>value.includes(normalizeText(t))))return"request_details";if(["nao tenho interesse","nao interessa","sem interesse"].some(t=>value.includes(normalizeText(t))))return"not_interested";if(["tenho interesse","estou interessado","estou interessada","me interessei","gostei do imovel"].some(t=>value.includes(normalizeText(t))))return"interested";return"reply";}
function extractMetaText(message:any){if(message?.type==="text")return clean(message.text?.body,4000);if(message?.type==="button")return clean(message.button?.text||message.button?.payload,4000);if(message?.type==="interactive")return clean(message.interactive?.button_reply?.title||message.interactive?.button_reply?.id||message.interactive?.list_reply?.title||message.interactive?.list_reply?.id,4000);return clean(message?.caption,4000);}

Deno.serve(async(request)=>{
  if(request.method!=="POST")return json({error:"method_not_allowed"},405);
  if(!supabaseUrl||!serviceKey||!maintenanceSecret)return json({error:"server_not_configured"},503);
  if(request.headers.get("x-platform-maintenance-secret")!==maintenanceSecret)return json({error:"unauthorized"},401);
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  const inbox=await admin.from("outreach_provider_event_inbox").select("id,provider,provider_event_id,provider_message_id,event_type,payload,processing_attempts").is("processed_at",null).order("received_at",{ascending:true}).limit(100);
  if(inbox.error)return json({error:inbox.error.message},500);
  let processed=0,deferred=0,failed=0;
  for(const event of inbox.data||[]){
    try{
      const attemptResult=await admin.from("buyer_outreach_delivery_attempts").select("id,agency_id,opportunity_id,lead_id,property_id,status").eq("provider_message_id",event.provider_message_id).order("attempted_at",{ascending:false}).limit(1).maybeSingle();
      if(attemptResult.error)throw new Error(attemptResult.error.message);
      if(!attemptResult.data){
        await admin.from("outreach_provider_event_inbox").update({processing_attempts:Number(event.processing_attempts||0)+1,last_error:"Tentativa ainda não correlacionada."}).eq("id",event.id);
        deferred++;continue;
      }
      const attempt:any=attemptResult.data;
      const now=new Date().toISOString();
      if(event.event_type==="meta_message"){
        const message:any=event.payload;
        const responseText=extractMetaText(message);
        const responseKind=classifyResponse(responseText);
        const receivedAt=message?.timestamp?new Date(Number(message.timestamp)*1000).toISOString():now;
        const response=await admin.from("buyer_outreach_responses").upsert({agency_id:attempt.agency_id,opportunity_id:attempt.opportunity_id,lead_id:attempt.lead_id,property_id:attempt.property_id,channel:"whatsapp",provider:"meta_whatsapp",provider_event_id:clean(message?.id,240)||event.provider_event_id,provider_message_id:clean(message?.id,240)||event.provider_event_id,response_text:responseText||null,response_kind:responseKind,received_at:receivedAt,provider_payload:message},{onConflict:"provider,provider_event_id",ignoreDuplicates:true});
        if(response.error)throw new Error(response.error.message);
        if(responseKind==="opt_out"){
          const permission=await admin.from("lead_contact_permissions").update({automated_property_alerts_allowed:false,whatsapp_allowed:false,revoked_at:receivedAt,updated_at:receivedAt}).eq("agency_id",attempt.agency_id).eq("lead_id",attempt.lead_id);
          if(permission.error)throw new Error(permission.error.message);
        }
      }else{
        const isMeta=event.provider==="meta_whatsapp";
        const raw:any=event.payload;
        const mapped=isMeta?clean(raw?.status,40).toLowerCase():event.event_type==="email.sent"?"sent":event.event_type==="email.delivered"?"delivered":event.event_type==="email.opened"?"read":["email.failed","email.bounced","email.complained","email.suppressed"].includes(event.event_type)?"failed":"";
        if(!["sent","delivered","read","failed"].includes(mapped))throw new Error("Evento não suportado para reconciliação.");
        const current=clean(attempt.status,40);const rank:Record<string,number>={prepared:0,sending:1,sent:2,delivered:3,read:4};const patch:Record<string,unknown>={provider_payload:raw};
        if(mapped==="failed"&&!["delivered","read"].includes(current)){patch.status="failed";patch.error_message=isMeta?clean(raw?.errors?.[0]?.title||raw?.errors?.[0]?.message||"Falha informada pela Meta.",1200):clean(raw?.data?.bounce?.message||raw?.data?.reason||raw?.data?.error||`Falha ${event.event_type}`,1200);}else if(mapped!=="failed"&&(rank[mapped]??-1)>(rank[current]??-1)){patch.status=mapped;if(mapped==="sent")patch.sent_at=now;if(mapped==="delivered")patch.delivered_at=now;if(mapped==="read"){patch.read_at=now;patch.delivered_at=now;}}
        if(Object.prototype.hasOwnProperty.call(patch,"status")){const updated=await admin.from("buyer_outreach_delivery_attempts").update(patch).eq("id",attempt.id);if(updated.error)throw new Error(updated.error.message);}
        if(mapped==="failed"&&!["delivered","read"].includes(current)){const opp=await admin.from("buyer_property_opportunities").update({status:"failed",last_error:patch.error_message||"Falha do provedor.",updated_at:now}).eq("id",attempt.opportunity_id);if(opp.error)throw new Error(opp.error.message);}
        if(!isMeta&&["email.bounced","email.complained","email.suppressed"].includes(event.event_type)){const permission=await admin.from("lead_contact_permissions").update({email_allowed:false,automated_property_alerts_allowed:false,revoked_at:now,updated_at:now}).eq("agency_id",attempt.agency_id).eq("lead_id",attempt.lead_id);if(permission.error)throw new Error(permission.error.message);}
      }
      await admin.from("outreach_provider_event_inbox").update({processed_at:now,processing_attempts:Number(event.processing_attempts||0)+1,last_error:null}).eq("id",event.id);
      processed++;
    }catch(error){await admin.from("outreach_provider_event_inbox").update({processing_attempts:Number(event.processing_attempts||0)+1,last_error:error instanceof Error?error.message.slice(0,1000):String(error).slice(0,1000)}).eq("id",event.id);failed++;}
  }
  return json({checked:(inbox.data||[]).length,processed,deferred,failed});
});
