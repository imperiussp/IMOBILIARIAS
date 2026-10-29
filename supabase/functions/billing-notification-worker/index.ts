import { createClient } from "jsr:@supabase/supabase-js@2.112.4";

const base = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const secret = Deno.env.get("BILLING_NOTIFICATION_SECRET") || "";
const resendKey = Deno.env.get("RESEND_API_KEY") || "";
const sender = Deno.env.get("RESEND_FROM_EMAIL") || "";
const enabled = Deno.env.get("BILLING_NOTIFICATIONS_ENABLED") === "true";
const mode = Deno.env.get("BILLING_NOTIFICATION_MODE") || "test";
const testRecipients = (Deno.env.get("BILLING_TEST_RECIPIENTS") || "").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers: {"content-type":"application/json"}});
const formatMoney = (n:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const day = (value:string) => { const [y,m,d]=value.slice(0,10).split("-"); return `${d}/${m}/${y}`; };
const esc = (s:string) => s.replace(/[&<>"']/g, x => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]||x));

Deno.serve(async (req)=>{
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);
  if(!base||!key||!secret) return json({error:"billing_core_not_configured"},503);
  if(req.headers.get("x-billing-notification-secret")!==secret) return json({error:"unauthorized"},401);
  const db=createClient(base,key,{auth:{persistSession:false}});
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=(key:string)=>parts.find(p=>p.type===key)?.value||"";
  const today=`${part("year")}-${part("month")}-${part("day")}`;
  const dryRun=req.headers.get("x-billing-dry-run")==="true";
  const {data:items,error}=await db.rpc("billing_due_notification_candidates",{p_local_date:today});
  if(error) return json({error:error.message},500);
  if(dryRun) return json({dry_run:true,date:today,candidates:(items||[]).length,types:(items||[]).reduce((a:any,x:any)=>(a[x.notification_type]=(a[x.notification_type]||0)+1,a),{})});
  if(!enabled) return json({error:"notifications_disabled",date:today},423);
  if(!resendKey||!sender) return json({error:"email_provider_not_configured"},503);
  if(mode!=="test" && mode!=="live") return json({error:"invalid_notification_mode"},423);
  if(mode==="test" && testRecipients.length===0) return json({error:"test_recipient_allowlist_required"},423);
  let sent=0,skipped=0,failed=0;
  for(const item of items||[]){
    if(mode==="test" && !testRecipients.includes(String(item.billing_email||"").trim().toLowerCase())){skipped++;continue;}
    const reserve=await db.from("billing_notification_deliveries").upsert({
      subscription_id:item.subscription_id,notification_type:item.notification_type,due_date:item.due_date,
      destination:item.billing_email,status:"sending"
    },{onConflict:"subscription_id,notification_type,due_date",ignoreDuplicates:true}).select("id").maybeSingle();
    if(reserve.error){if(reserve.error.code==="23505"){skipped++;continue;}failed++;continue;}
    const id=reserve.data?.id;
    if(!id){skipped++;continue;}
    const url=item.checkout_url&&/^https:\/\/[^\s]+$/i.test(item.checkout_url)?item.checkout_url:null;
    if(!url){await db.from("billing_notification_deliveries").update({status:"failed",error_message:"valid_checkout_url_missing",updated_at:new Date().toISOString()}).eq("id",id);failed++;continue;}
    const subject=item.notification_type==="before_5d"?
      `LENOY | Sua mensalidade vence em 5 dias — ${day(item.due_date)}`:
      `LENOY | Mensalidade vence hoje — ${day(item.due_date)}`;
    if (!Number.isFinite(Number(item.amount)) || Number(item.amount)<=0){failed++;await db.from("billing_notification_deliveries").update({status:"failed",error_message:"invalid_amount"}).eq("id",id);continue;}
    const plain=`Olá, ${item.agency_name}.\nPlano: ${item.plan_name}\nCiclo: ${item.billing_cycle==="annual"?"Anual":"Mensal"}\nValor: ${formatMoney(Number(item.amount))}\nVencimento: ${day(item.due_date)}\nPagar/gerar cobrança: ${url}\nSe já pagou, aguarde a confirmação automática.\nLENOY IMOBILIÁRIAS`;
    const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#24384d"><h2>LENOY IMOBILIÁRIAS</h2><p>Olá, ${esc(item.agency_name)}.</p><p>${item.notification_type==="before_5d"?"Sua assinatura vence em cinco dias.":"Sua assinatura vence hoje."}</p><p><strong>Plano:</strong> ${esc(item.plan_name)}<br><strong>Valor:</strong> ${formatMoney(Number(item.amount))}<br><strong>Vencimento:</strong> ${day(item.due_date)}</p><p><a href="${esc(url)}" style="background:#0b2946;color:white;padding:14px 20px;text-decoration:none;border-radius:6px">Pagar assinatura</a></p><p>Se já pagou, aguarde a confirmação automática.</p></div>`;
    try{
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":`Bearer ${resendKey}`,"content-type":"application/json","idempotency-key":id},body:JSON.stringify({from:sender,to:[item.billing_email],subject,text:plain,html})});
      const body=await response.json().catch(()=>({}));
      await db.from("billing_notification_deliveries").update({status:response.ok?"sent":"failed",provider_message_id:body?.id||null,error_message:response.ok?null:String(body?.message||response.status),updated_at:new Date().toISOString()}).eq("id",id);
      if(response.ok)sent++;else failed++;
    }catch(err){
      await db.from("billing_notification_deliveries").update({status:"failed",error_message:String(err),updated_at:new Date().toISOString()}).eq("id",id);
      failed++;
    }
  }
  return json({date:today,candidates:(items||[]).length,sent,skipped,failed},failed?207:200);
});
