import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendKey = Deno.env.get("RESEND_API_KEY") || "";
const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "";
const wordpressMailUrl = (Deno.env.get("WORDPRESS_AUTH_MAIL_URL") || "https://lenoy.com.br/wp-json/lenoy/v1/auth-mail").trim();
const handle = (Deno.env.get("INFINITEPAY_HANDLE") || "robsonmasselli").replace(/^\$/, "").trim();
const siteUrl = (Deno.env.get("PLATFORM_SITE_URL") || "https://imoveis.lenoy.com.br").replace(/\/$/,"");
const db = url && serviceKey ? createClient(url,serviceKey,{auth:{persistSession:false}}) : null;
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json; charset=utf-8"}});
const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const fmtDate=(s:string)=>s.slice(0,10).split("-").reverse().join("/");
const dateBR=(d:Date)=>{const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const val=(k:string)=>p.find(x=>x.type===k)?.value||"";return `${val("year")}-${val("month")}-${val("day")}`;};
const dayNumber=(s:string)=>Math.floor(Date.parse(s+"T00:00:00Z")/86400000);
const rounded=(n:number)=>Math.round(n*100)/100;
function validUrl(value:unknown):value is string {
 if(typeof value!=="string")return false;
 try{const u=new URL(value);return u.protocol==="https:" && Boolean(u.hostname) && !u.username && !u.password;}catch{return false;}
}
async function webhookSecret(){
 const configured=(Deno.env.get("INFINITEPAY_WEBHOOK_SECRET")||"").trim();
 if(configured)return configured;
 const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`lenoy-infinitepay-webhook:${serviceKey}`));
 return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function ensureCheckout(item:any,amount:number,base:number,discountId:string|null,discountPercent:number,readonly:boolean){
 if(!db)throw Error("db_not_configured");
 const {data:previous,error:lookupError}=await db.from("billing_checkout_sessions")
 .select("id,checkout_url,amount,expires_at,created_at").eq("agency_id",item.agency_id).eq("plan_id",item.plan_id)
 .eq("provider","infinitepay").eq("charge_type","subscription").eq("billing_cycle",item.billing_cycle||"monthly")
 .eq("amount",amount).eq("status","pending").order("created_at",{ascending:false}).limit(5);
 if(lookupError)throw Error(lookupError.message);
 const match=(previous||[]).find((x:any)=>validUrl(x.checkout_url)&&(!x.expires_at||new Date(x.expires_at).getTime()>Date.now()));
 if(match)return {checkout_url:match.checkout_url,checkout_id:match.id,reused:true};
 if(readonly)return {checkout_url:null,checkout_id:null,reused:false};
 if(!handle)throw Error("infinitepay_handle_not_configured");
 const id=crypto.randomUUID();
 const orderNsu=id;
 const hook=`${url}/functions/v1/infinitepay-webhook?secret=${encodeURIComponent(await webhookSecret())}`;
 const description=`LENOY IMOBILIÁRIAS — ${item.plan_name} (${item.billing_cycle==="annual"?"anual":"mensal"})`;
 const payload={handle,redirect_url:`${siteUrl}/admin/?pagamento=retorno`,webhook_url:hook,order_nsu:orderNsu,
 items:[{quantity:1,price:Math.round(amount*100),description}],
 customer:{name:item.agency_name,email:item.destination}};
 const created=await db.from("billing_checkout_sessions").insert({id,agency_id:item.agency_id,plan_id:item.plan_id,
 provider:"infinitepay",status:"created",amount,base_amount:base,discount_percent:discountPercent,discount_id:discountId,
 charge_type:"subscription",currency:"BRL",billing_cycle:item.billing_cycle||"monthly",
 order_nsu:orderNsu,provider_payload:{request:payload,pricing:{base_amount:base,final_amount:amount,discount_percent:discountPercent,charge_type:"subscription",billing_due_date:item.due_date}}});
 if(created.error)throw Error(created.error.message);
 try{
   const response=await fetch("https://api.checkout.infinitepay.io/links",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
   const body=await response.json().catch(()=>({}));
   const checkoutUrl=String(body?.url||"");
   if(!response.ok||!validUrl(checkoutUrl))throw Error(String(body?.message||body?.error||`InfinitePay HTTP ${response.status}`));
   const saved=await db.from("billing_checkout_sessions").update({status:"pending",checkout_url:checkoutUrl,provider_session_id:body?.slug?String(body.slug):null,
       provider_payload:{request:payload,response:body,pricing:{base_amount:base,final_amount:amount,discount_percent:discountPercent,charge_type:"subscription",billing_due_date:item.due_date}},
       updated_at:new Date().toISOString()}).eq("id",id);
   if(saved.error)throw Error(saved.error.message);
   return {checkout_url:checkoutUrl,checkout_id:id,reused:false};
 }catch(e){
   await db.from("billing_checkout_sessions").update({status:"failed",updated_at:new Date().toISOString(),
      provider_payload:{request:payload,error:String(e)}}).eq("id",id);
   throw e;
 }
}
async function getCandidates(date:string){
 if(!db)throw Error("db_not_configured");
 const {data:subs,error}=await db.from("agency_subscriptions")
  .select("id,agency_id,plan_id,status,billing_cycle,renews_at,ends_at,created_at")
  .in("status",["active","past_due"]).order("created_at",{ascending:false});
 if(error)throw Error(error.message);
 const latest=new Set<string>();const result:any[]=[];
 for(const sub of subs||[]){
  if(latest.has(sub.agency_id))continue;latest.add(sub.agency_id);
  const dueAt=sub.renews_at||sub.ends_at;
  if(!dueAt)continue;
  const dueDate=dateBR(new Date(dueAt));
  const days=dayNumber(dueDate)-dayNumber(date);
  if(days!==5 && days!==0)continue;
  const [{data:agency},{data:plan},{data:profile},{data:billing}] = await Promise.all([
   db.from("agencies").select("name,email,status").eq("id",sub.agency_id).maybeSingle(),
   db.from("subscription_plans").select("name,monthly_price,annual_price,active,features").eq("id",sub.plan_id).maybeSingle(),
   db.from("agency_billing_profiles").select("implementation_status,monthly_price_override").eq("agency_id",sub.agency_id).maybeSingle(),
   db.from("billing_customers").select("billing_email").eq("agency_id",sub.agency_id).eq("provider","infinitepay").order("updated_at",{ascending:false}).limit(1).maybeSingle()
  ]);
  if(!agency||!["active","past_due"].includes(String(agency.status))||!plan?.active||plan.features?.internal_only===true)continue;
  if(!["paid","waived"].includes(String(profile?.implementation_status||"")))continue;
  const destination=String(billing?.billing_email||agency.email||"").trim();
  if(!/^\S+@\S+\.\S+$/.test(destination))continue;
  const cycle=sub.billing_cycle==="annual"?"annual":"monthly";
  const base=rounded(Number(cycle==="annual"?plan.annual_price:profile?.monthly_price_override??plan.monthly_price));
  if(!(base>0) || !Number.isFinite(base))continue;
  const {data:discount}=await db.from("agency_billing_discounts").select("id,final_amount,discount_percent,valid_until")
    .eq("agency_id",sub.agency_id).eq("plan_id",sub.plan_id).eq("billing_cycle",cycle).eq("status","active")
    .order("created_at",{ascending:false}).limit(1).maybeSingle();
  const usable=discount&&(!discount.valid_until||new Date(discount.valid_until).getTime()>Date.now())
    &&Number(discount.final_amount)>=0&&Number(discount.final_amount)<base;
  const amount=rounded(usable?Number(discount.final_amount):base);
  if(!(amount>0))continue; // Free/100% subscriptions are never charged.
  result.push({subscription_id:sub.id,agency_id:sub.agency_id,plan_id:sub.plan_id,
    agency_name:String(agency.name||""),plan_name:String(plan.name||""),billing_cycle:cycle,
    destination,due_date:dueDate,notification_type:days===5?"before_5d":"due_today",
    amount,base,discountId:usable?String(discount.id):null,discountPercent:usable?Number(discount.discount_percent||0):0});
 }
 return result;
}
async function sendWordPressMail(destination:string,subject:string,plain:string,html:string){
 if(!db)throw Error("db_not_configured");
 const bytes=crypto.getRandomValues(new Uint8Array(36));
 const raw=String.fromCharCode(...bytes);
 const token=btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
 const tokenHash=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const {data:row,error}=await db.from("auth_mail_bridge_requests").insert({
  token_hash:tokenHash,email:destination,subject,html_body:html,text_body:plain,kind:"billing_notice",
  expires_at:new Date(Date.now()+10*60*1000).toISOString()
 }).select("id").single();
 if(error||!row)throw Error(error?.message||"wordpress_email_queue_failed");
 try{
  const endpoints=[`${siteUrl}/billing-mail-transport.php`,wordpressMailUrl];
  let lastFailure="mail_transports_unavailable";
  for(const endpoint of endpoints){
   try{
    const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});
    const body=await response.json().catch(()=>({}));
    if(response.ok && body?.ok===true)return {id:String(row.id),provider:body?.provider||"php"};
    lastFailure=String(body?.error||body?.message||`mail_endpoint_http_${response.status}`);
   }catch(e){lastFailure=String(e);}
  }
  throw Error(lastFailure);
 }catch(err){
  await db.from("auth_mail_bridge_requests").update({last_error:String(err)}).eq("id",row.id);
  throw err;
 }
}
async function dispatch(item:any,checkoutUrl:string){
 if(!db)throw Error("db_not_configured");
 const identity={subscription_id:item.subscription_id,notification_type:item.notification_type,due_date:item.due_date};
 const {data:existing,error:readError}=await db.from("billing_notification_deliveries").select("id,status,updated_at").match(identity).maybeSingle();
 if(readError)throw Error(readError.message);
 if(existing?.status==="sent")return "skipped";
 if(existing?.status==="sending"&&Date.now()-new Date(existing.updated_at).getTime()<20*60000)return "skipped";
 let id=existing?.id;
 if(id){
  const {error}=await db.from("billing_notification_deliveries").update({status:"sending",error_message:null,updated_at:new Date().toISOString()}).eq("id",id);
  if(error)throw Error(error.message);
 }else{
  const {data,error}=await db.from("billing_notification_deliveries").insert({...identity,destination:item.destination,status:"sending"}).select("id").single();
  if(error){if(error.code==="23505")return "skipped";throw Error(error.message);}
  id=data.id;
 }
 const subject=item.notification_type==="before_5d"
    ?`LENOY | Sua assinatura vence em 5 dias — ${fmtDate(item.due_date)}`
    :`LENOY | Sua assinatura vence hoje — ${fmtDate(item.due_date)}`;
 const msg=`Olá, ${item.agency_name}.\nPlano: ${item.plan_name}\nCiclo: ${item.billing_cycle==="annual"?"Anual":"Mensal"}\nValor da cobrança: ${money(item.amount)}\nVencimento: ${fmtDate(item.due_date)}\nLink de pagamento: ${checkoutUrl}\nSe já realizou o pagamento, desconsidere e aguarde a confirmação.\nLENOY IMOBILIÁRIAS`;
 try {
  const html=`<div style="font-family:Arial,sans-serif;max-width:640px"><h2>LENOY IMOBILIÁRIAS</h2><p>${escapeHtml(item.agency_name)},</p><p>${item.notification_type==="before_5d"?"Sua assinatura vence em cinco dias.":"Sua assinatura vence hoje."}</p><p>Plano: ${escapeHtml(item.plan_name)}<br>Valor: <strong>${money(item.amount)}</strong><br>Vencimento: ${fmtDate(item.due_date)}</p><p><a href="${escapeHtml(checkoutUrl)}">Pagar assinatura pela InfinitePay</a></p><p>Se já pagou, desconsidere.</p></div>`;
  let providerId="";
  if(resendKey&&resendFrom){
   const send=await fetch("https://api.resend.com/emails",{method:"POST",
    headers:{"authorization":`Bearer ${resendKey}`,"content-type":"application/json","idempotency-key":id},
    body:JSON.stringify({from:resendFrom,to:[item.destination],subject,text:msg,html})});
   const data=await send.json().catch(()=>({}));
   if(!send.ok)throw Error(String(data?.message||`Resend HTTP ${send.status}`));
   providerId=String(data?.id||"");
  }else{
   const wordpress=await sendWordPressMail(item.destination,subject,msg,html);
   providerId=wordpress.id;
  }
  await db.from("billing_notification_deliveries").update({status:"sent",
    provider_message_id:providerId||null,error_message:null,updated_at:new Date().toISOString()}).eq("id",id);
  return "sent";
 }catch(e){
  await db.from("billing_notification_deliveries").update({status:"failed",error_message:String(e),updated_at:new Date().toISOString()}).eq("id",id);
  return "failed";
 }
}
Deno.serve(async(request)=>{
 if(request.method!=="POST")return json({error:"method_not_allowed"},405);
 if(!db||!serviceKey)return json({error:"backend_unavailable"},503);
 if(request.headers.get("authorization")!==`Bearer ${serviceKey}`)return json({error:"unauthorized"},401);
 try {
  const {data:settings,error:configError}=await db.from("billing_automation_settings").select("emails_enabled").eq("id",1).single();
  if(configError)return json({error:"billing_settings_unavailable"},503);
  const today=dateBR(new Date());
  const candidates=await getCandidates(today);
  if(request.headers.get("x-billing-dry-run")==="true")return json({dry_run:true,date:today,candidates:candidates.length,types:candidates.reduce((a:any,x:any)=>(a[x.notification_type]=(a[x.notification_type]||0)+1,a),{})});
  if(!settings.emails_enabled)return json({date:today,disabled:true,candidates:candidates.length});
  let sent=0,failed=0,skipped=0;
  for(const item of candidates){
   try{
    const checkout=await ensureCheckout(item,item.amount,item.base,item.discountId,item.discountPercent,false);
    if(!validUrl(checkout.checkout_url)){failed++;continue;}
    const result=await dispatch(item,checkout.checkout_url);
    if(result==="sent")sent++;else if(result==="skipped")skipped++;else failed++;
   }catch(_error){failed++;}
  }
  return json({date:today,candidates:candidates.length,sent,failed,skipped},failed?207:200);
 }catch(error){return json({error:error instanceof Error?error.message:"billing_worker_error"},500);}
});
