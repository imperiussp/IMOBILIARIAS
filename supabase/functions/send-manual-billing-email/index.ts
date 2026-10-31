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
async function getManualCandidate(agencyId:string){
 if(!db)throw Error("db_not_configured");
 const {data:subs,error}=await db.from("agency_subscriptions")
  .select("id,agency_id,plan_id,status,billing_cycle,renews_at,ends_at,created_at")
  .eq("agency_id",agencyId).in("status",["active","past_due","expired"]).order("created_at",{ascending:false});
 if(error)throw Error(error.message);
 const latest=new Set<string>();const result:any[]=[];
 for(const sub of subs||[]){
  if(latest.has(sub.agency_id))continue;latest.add(sub.agency_id);
  const dueAt=sub.renews_at||sub.ends_at;
  if(!dueAt)continue;
  const dueDate=dateBR(new Date(dueAt));
  
  const [{data:agency},{data:plan},{data:profile},{data:billing}] = await Promise.all([
   db.from("agencies").select("name,email,status").eq("id",sub.agency_id).maybeSingle(),
   db.from("subscription_plans").select("name,monthly_price,annual_price,active,features").eq("id",sub.plan_id).maybeSingle(),
   db.from("agency_billing_profiles").select("implementation_status,monthly_price_override").eq("agency_id",sub.agency_id).maybeSingle(),
   db.from("billing_customers").select("billing_email").eq("agency_id",sub.agency_id).eq("provider","infinitepay").order("updated_at",{ascending:false}).limit(1).maybeSingle()
  ]);
  if(!agency||!["active","past_due","suspended"].includes(String(agency.status))||!plan?.active||plan.features?.internal_only===true)continue;
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
    destination,due_date:dueDate,notification_type:"due_today",
    amount,base,discountId:usable?String(discount.id):null,discountPercent:usable?Number(discount.discount_percent||0):0});
 }
 return result[0]||null;
}

const cors=(origin:string|null)=>{
 const approved=[new URL(siteUrl).origin,"https://imoveis.lenoy.com.br"];
 return {"access-control-allow-origin":origin&&approved.includes(origin)?origin:approved[0],
   "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
   "access-control-allow-methods":"POST, OPTIONS","vary":"Origin"};
};
const output=(value:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(value),{
 status,headers:{"content-type":"application/json; charset=utf-8",...cors(origin)}
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function compose(item:any,link:string){
 const amount=money(item.amount),due=fmtDate(item.due_date);
 const period=item.billing_cycle==="annual"?"Anual":"Mensal";
 const subject="LENOY Imobiliárias | Aviso de vencimento - "+due;
 const text=[
  "Olá, equipe da "+item.agency_name+"!","",
  "A LENOY Imobiliárias informa os dados de vencimento da sua assinatura.","",
  "Plano: "+item.plan_name,"Periodicidade: "+period,
  "Valor: "+amount,"Data de vencimento: "+due,"",
  "Para efetuar o pagamento e manter os serviços ativos, utilize o link seguro:",
  link,"","Caso já tenha realizado o pagamento, desconsidere este aviso.","",
  "Atenciosamente,","Equipe LENOY Imobiliárias","contato@lenoy.com.br"
 ].join("\n");
 const safe=escapeHtml(link);
 const html=[
  '<div style="background:#f4f6f9;padding:28px 12px;font-family:Arial,sans-serif;color:#18293d">',
  '<div style="max-width:600px;margin:auto;background:#fff;border:1px solid #dfe5ed;border-radius:14px;overflow:hidden">',
  '<div style="background:#0b2946;color:#fff;padding:24px 28px;font-size:20px;font-weight:700">LENOY IMOBILIÁRIAS</div>',
  '<div style="padding:26px 28px"><p>Olá, equipe da ',escapeHtml(item.agency_name),'!</p>',
  '<p>Informamos os dados de vencimento da sua assinatura:</p>',
  '<div style="background:#f6f8fb;border:1px solid #e5eaf0;border-radius:10px;padding:16px;line-height:1.9">',
  'Plano: ',escapeHtml(item.plan_name),'<br>Periodicidade: ',period,
  '<br>Valor: <strong>',amount,'</strong><br>Vencimento: <strong>',due,'</strong></div>',
  '<p style="margin-top:22px">Para efetuar o pagamento e manter seus serviços ativos:</p>',
  '<p style="text-align:center;margin:26px 0"><a href="',safe,
  '" style="display:inline-block;background:#0b2946;border-radius:9px;padding:15px 25px;color:#fff;text-decoration:none;font-weight:bold">',
  'Pagar com InfinitePay</a></p>',
  '<p style="font-size:12px;color:#667589">Se o botão não abrir, copie este link: <a href="',safe,'">',safe,'</a></p>',
  '<p>Caso já tenha realizado o pagamento, desconsidere este aviso.</p>',
  '<p>Atenciosamente,<br>Equipe LENOY Imobiliárias<br>contato@lenoy.com.br</p></div></div></div>'
 ].join("");
 return {subject,text,html};
}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=="POST")return output({error:"method_not_allowed"},405,origin);
 if(!db||!url||!serviceKey)return output({error:"backend_unavailable"},503,origin);
 const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
 if(!jwt||!anon)return output({error:"Acesso não autorizado."},401,origin);
 const caller=createClient(url,anon,{auth:{persistSession:false},global:{headers:{Authorization:"Bearer "+jwt}}});
 const auth=await caller.auth.getUser(jwt);
 if(auth.error||!auth.data.user)return output({error:"Sessão inválida."},401,origin);
 const allowed=await caller.rpc("is_platform_admin");
 if(allowed.error||allowed.data!==true)return output({error:"Envio exclusivo do administrador LENOY."},403,origin);
 const data=await req.json().catch(()=>null);
 const action=String(data?.action||"preview"),agencyId=String(data?.agency_id||"");
 if(!uuid.test(agencyId))return output({error:"Cliente inválido."},400,origin);
 try {
  if(action==="history"){
   const history=await db.from("billing_manual_email_deliveries")
     .select("request_id,destination,due_date,amount,status,created_at,error_message,checkout_url")
     .eq("agency_id",agencyId).order("created_at",{ascending:false}).limit(8);
   if(history.error)throw Error(history.error.message);
   return output({history:history.data||[]},200,origin);
  }
  if(action!=="preview"&&action!=="send")return output({error:"Ação desconhecida."},400,origin);
  const item=await getManualCandidate(agencyId);
  if(!item)throw Error("Este cliente não possui assinatura comercial válida para cobrança.");
  const {data:controls,error:controlError}=await db.from("platform_release_controls")
   .select("real_billing_enabled,maintenance_mode").limit(1).maybeSingle();
  const enabled=!controlError&&controls?.real_billing_enabled===true&&controls?.maintenance_mode!==true;
  if(action==="preview")return output({
    agency_name:item.agency_name,recipient:item.destination,plan:item.plan_name,
    billing_cycle:item.billing_cycle,amount:item.amount,due_date:item.due_date,
    subject:compose(item,"(link gerado no envio)").subject,payment_enabled:enabled
  },200,origin);
  if(!enabled)return output({error:"A geração de cobranças está desativada neste ambiente."},409,origin);
  if(!resendKey||!resendFrom)return output({error:"Resend não configurado."},503,origin);
  const requestId=String(data?.request_id||"");
  if(!uuid.test(requestId))return output({error:"Identificador inválido."},400,origin);
  const audit=await db.from("billing_manual_email_deliveries").insert({
    request_id:requestId,agency_id:agencyId,subscription_id:item.subscription_id,
    requested_by:auth.data.user.id,destination:item.destination,
    due_date:item.due_date,amount:item.amount,status:"sending"
  });
  if(audit.error){
   if(audit.error.code==="23505")return output({error:"Este envio já foi solicitado. Confira o histórico."},409,origin);
   throw Error("Falha ao registrar a tentativa de envio.");
  }
  try {
   const checkout=await ensureCheckout(item,item.amount,item.base,item.discountId,item.discountPercent,false);
   if(!validUrl(checkout.checkout_url))throw Error("A InfinitePay não retornou link seguro.");
   const email=compose(item,checkout.checkout_url);
   const result=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{"authorization":"Bearer "+resendKey,"content-type":"application/json","idempotency-key":requestId},
    body:JSON.stringify({from:resendFrom,to:[item.destination],subject:email.subject,text:email.text,html:email.html})
   });
   const sent=await result.json().catch(()=>({}));
   if(!result.ok||!sent?.id)throw Error(String(sent?.message||"Resend retornou erro "+result.status));
   const saved=await db.from("billing_manual_email_deliveries").update({
     status:"sent",checkout_url:checkout.checkout_url,provider_message_id:String(sent.id),
     updated_at:new Date().toISOString()
   }).eq("request_id",requestId);
   if(saved.error)return output({ok:true,warning:"E-mail aceito pelo Resend, mas o registro não foi atualizado. Não reenvie sem conferir.",
     recipient:item.destination,checkout_url:checkout.checkout_url},200,origin);
   return output({ok:true,recipient:item.destination,checkout_url:checkout.checkout_url,
     amount:item.amount,due_date:item.due_date},200,origin);
  }catch(e){
   const reason=e instanceof Error?e.message:"Falha desconhecida";
   await db.from("billing_manual_email_deliveries").update({
     status:"failed",error_message:reason,updated_at:new Date().toISOString()
   }).eq("request_id",requestId);
   return output({error:reason},502,origin);
  }
 }catch(e){return output({error:e instanceof Error?e.message:"Erro ao preparar a cobrança."},400,origin);}
});
