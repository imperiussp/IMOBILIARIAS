import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const handle = (Deno.env.get("INFINITEPAY_HANDLE") || "robsonmasselli").replace(/^\$/, "").trim();
const siteUrl = (Deno.env.get("PLATFORM_SITE_URL") || "https://imoveis.lenoy.com.br").replace(/\/$/, "");
const configuredWebhookSecret = (Deno.env.get("INFINITEPAY_WEBHOOK_SECRET") || "").trim();
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8" } }); }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: number) { return Math.round(value * 100) / 100; }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function randomToken(bytes = 32) { const data = crypto.getRandomValues(new Uint8Array(bytes)); let raw = ""; for (const byte of data) raw += String.fromCharCode(byte); return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function sha256(value: string) { const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function webhookSecret() { if (configuredWebhookSecret) return configuredWebhookSecret; if (!serviceRoleKey) return ""; return sha256(`lenoy-infinitepay-webhook:${serviceRoleKey}`); }
function discountFor(base:number,coupon:any){
  const reduction = coupon.discount_type === "percent" ? base * numberValue(coupon.discount_value) / 100 : numberValue(coupon.discount_value);
  const finalAmount = Math.max(0, money(base - reduction));
  if (finalAmount >= base) return { error:"coupon_no_discount" };
  return { finalAmount, savings:money(base-finalAmount), discountPercent:money(((base-finalAmount)/base)*100) };
}
async function findUserIdByEmail(admin:any,email:string){
  for(let page=1;page<=5;page+=1){
    const result=await admin.auth.admin.listUsers({page,perPage:200});
    if(result.error)return null;
    const found=result.data.users.find((user:any)=>String(user.email||"").toLowerCase()===email.toLowerCase());
    if(found)return found.id as string;
    if(result.data.users.length<200)break;
  }
  return null;
}
async function ensureOnboardingInvite(admin:any,intentId:string){
  const {data:intent,error}=await admin.from("prepaid_purchase_intents").select("id,email,status,invite_sent_at,auth_user_id").eq("id",intentId).maybeSingle();
  if(error||!intent)return {sent:false,error:"purchase_intent_not_found"};
  if(intent.invite_sent_at)return {sent:true,user_id:intent.auth_user_id||null};
  const onboardingToken=randomToken();
  const onboardingTokenHash=await sha256(onboardingToken);
  const redirectTo=`${siteUrl}/ativar-imobiliaria/?pedido=${encodeURIComponent(intent.id)}&token=${encodeURIComponent(onboardingToken)}`;
  const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
  const email=String(intent.email||"").trim().toLowerCase();
  let userId:string|null=null;
  let sendError="";
  const invite=await admin.auth.admin.inviteUserByEmail(email,{data:{onboarding_kind:"prepaid_owner",purchase_intent_id:intent.id},redirectTo});
  if(!invite.error&&invite.data.user)userId=invite.data.user.id;
  else if(anonKey){
    const existingId=await findUserIdByEmail(admin,email);
    if(existingId){
      const publicClient=createClient(supabaseUrl,anonKey,{auth:{persistSession:false}});
      const otp=await publicClient.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo,shouldCreateUser:false}});
      if(!otp.error)userId=existingId; else sendError=otp.error.message;
    }else sendError=invite.error?.message||"Não foi possível enviar o convite.";
  }else sendError=invite.error?.message||"Não foi possível enviar o convite.";
  if(!userId){
    await admin.from("prepaid_purchase_intents").update({status:"paid",onboarding_token_hash:onboardingTokenHash,onboarding_expires_at:expiresAt,invite_error:sendError||"Falha ao enviar o e-mail de ativação.",updated_at:new Date().toISOString()}).eq("id",intent.id);
    return {sent:false,error:sendError||"invite_failed"};
  }
  await admin.from("prepaid_purchase_intents").update({status:"invite_sent",onboarding_token_hash:onboardingTokenHash,onboarding_expires_at:expiresAt,invite_sent_at:new Date().toISOString(),invite_error:null,auth_user_id:userId,updated_at:new Date().toISOString()}).eq("id",intent.id);
  return {sent:true,user_id:userId};
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "supabase_not_configured" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const email = String(payload.email || "").trim().toLowerCase();
  const planCode = String(payload.plan_code || "").trim().toLowerCase();
  const billingCycle = payload.billing_cycle === "annual" ? "annual" : "monthly";
  const couponCode = String(payload.coupon_code || "").trim().toUpperCase();
  const previewOnly = payload.preview_only === true;
  if (!planCode) return json({ error: "plan_required" }, 400);
  if (!previewOnly && !validEmail(email)) return json({ error: "valid_email_required" }, 400);

  const { data: plan, error: planError } = await admin.from("subscription_plans")
    .select("id,code,name,monthly_price,annual_price,implementation_fee,features,active")
    .eq("code", planCode).eq("active", true).maybeSingle();
  if (planError || !plan) return json({ error: "plan_not_found" }, 404);
  if (String(plan.features?.internal_only || "false").toLowerCase() === "true") return json({ error: "internal_plan_not_for_sale" }, 403);

  const implementationFee = money(numberValue(plan.implementation_fee));
  const implementationWaived = billingCycle === "annual" || implementationFee <= 0;
  const chargeType = billingCycle === "annual" || implementationWaived ? "subscription" : "implementation";
  const rawAmount = billingCycle === "annual" ? plan.annual_price : implementationWaived ? plan.monthly_price : plan.implementation_fee;
  const baseAmount = money(numberValue(rawAmount));
  if (baseAmount <= 0) return json({ error: "plan_price_not_configured" }, 409);

  let coupon:any = null;
  let deferredCoupon = false;
  let amount = baseAmount;
  let savings = 0;
  let discountPercent = 0;
  if (couponCode) {
    const found = await admin.from("platform_coupons").select("id,code,discount_type,discount_value,target,plan_codes,active").eq("code", couponCode).eq("active", true).maybeSingle();
    if (found.error || !found.data) return json({ error:"coupon_invalid" }, 404);
    coupon = found.data;
    if (!Array.isArray(coupon.plan_codes) || !coupon.plan_codes.includes(plan.code)) return json({ error:"coupon_not_for_plan" }, 409);
    if (coupon.target === "implementation" && chargeType !== "implementation") return json({ error:"coupon_not_for_charge" }, 409);
    deferredCoupon = coupon.target === "subscription" && chargeType === "implementation";
    const couponBase = deferredCoupon ? money(numberValue(billingCycle === "annual" ? plan.annual_price : plan.monthly_price)) : baseAmount;
    const calc:any = discountFor(couponBase,coupon);
    if (calc.error) return json({ error:calc.error }, 409);
    if (previewOnly) return json({ ok:true, coupon:{code:coupon.code,target:coupon.target,discount_type:coupon.discount_type,discount_value:coupon.discount_value}, plan:{code:plan.code,name:plan.name}, deferred:deferredCoupon, charge_type:deferredCoupon?"subscription":chargeType, base_amount:couponBase, final_amount:calc.finalAmount, savings:calc.savings });
    if (!deferredCoupon) { amount=calc.finalAmount; savings=calc.savings; discountPercent=calc.discountPercent; }
  } else if (previewOnly) return json({ error:"coupon_required" },400);

  const allowed = await admin.rpc("platform_runtime_action_allowed", { p_action: "billing" });
  if (allowed.error) return json({ error: "release_controls_unavailable" }, 503);
  if (allowed.data !== true) return json({ error: "billing_blocked_by_release_control" }, 423);
  const secret = await webhookSecret();
  if (amount > 0 && (!handle || !secret)) return json({ error: "infinitepay_not_configured" }, 503);

  const statusToken = randomToken();
  const statusTokenHash = await sha256(statusToken);
  const intentId = crypto.randomUUID();
  const checkoutId = crypto.randomUUID();
  const orderNsu = checkoutId;
  const redirectParams = new URLSearchParams({ pedido: intentId, token: statusToken });
  const redirectUrl = `${siteUrl}/pagamento/retorno/?${redirectParams.toString()}`;
  const webhookUrl = amount > 0 ? `${supabaseUrl}/functions/v1/infinitepay-webhook?secret=${encodeURIComponent(secret)}` : "";
  const description = billingCycle === "annual" ? `LENOY IMOBILIÁRIAS — ${plan.name} (anual)` : implementationWaived ? `LENOY IMOBILIÁRIAS — ${plan.name} (mensal)` : `LENOY IMOBILIÁRIAS — Implantação · ${plan.name}`;
  const checkoutPayload = amount > 0 ? { handle, redirect_url: redirectUrl, webhook_url: webhookUrl, order_nsu: orderNsu, items: [{ quantity: 1, price: Math.round(amount * 100), description }], customer: { name: "Cliente LENOY", email } } : null;
  const couponSnapshot = coupon ? { code:coupon.code,target:coupon.target,discount_type:coupon.discount_type,discount_value:coupon.discount_value,deferred:deferredCoupon } : null;
  const now = new Date().toISOString();
  const zeroCharge = amount === 0 && !deferredCoupon;

  const intentInsert = await admin.from("prepaid_purchase_intents").insert({ id:intentId,email,plan_id:plan.id,billing_cycle:billingCycle,charge_type:chargeType,base_amount:baseAmount,amount,currency:"BRL",status:zeroCharge?"paid":"created",public_status_token_hash:statusTokenHash,coupon_id:coupon?.id||null,paid_at:zeroCharge?now:null });
  if (intentInsert.error) return json({ error: intentInsert.error.message }, 500);
  const checkoutInsert = await admin.from("billing_checkout_sessions").insert({ id:checkoutId,agency_id:null,purchase_intent_id:intentId,plan_id:plan.id,provider:"infinitepay",status:zeroCharge?"paid":"created",amount,paid_amount:zeroCharge?0:null,base_amount:baseAmount,discount_percent:discountPercent,discount_id:null,platform_coupon_id:coupon?.id||null,charge_type:chargeType,implementation_waived:implementationWaived,currency:"BRL",billing_cycle:billingCycle,order_nsu:orderNsu,created_by:null,completed_at:zeroCharge?now:null,provider_payload:{request:checkoutPayload,pricing:{base_amount:baseAmount,final_amount:amount,savings,discount_percent:discountPercent,charge_type:chargeType,implementation_waived:implementationWaived,coupon:couponSnapshot,full_coupon:zeroCharge}} });
  if (checkoutInsert.error) { await admin.from("prepaid_purchase_intents").update({ status:"failed",updated_at:now }).eq("id",intentId); return json({ error: checkoutInsert.error.message }, 500); }
  await admin.from("prepaid_purchase_intents").update({ checkout_id:checkoutId,updated_at:now }).eq("id",intentId);

  if (zeroCharge) {
    const invite = await ensureOnboardingInvite(admin,intentId);
    return json({checkout_url:redirectUrl,purchase_id:intentId,status_token:statusToken,plan:{code:plan.code,name:plan.name},billing_cycle:billingCycle,charge_type:chargeType,implementation_waived:implementationWaived,base_amount:baseAmount,amount:0,savings,coupon:couponSnapshot,full_discount:true,invite_sent:invite.sent});
  }

  try {
    const response = await fetch("https://api.checkout.infinitepay.io/links", { method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(checkoutPayload) });
    const body = await response.json().catch(() => null); const checkoutUrl=String(body?.url||"").trim();
    if (!response.ok || !checkoutUrl) throw new Error(body?.message || body?.error || `InfinitePay HTTP ${response.status}`);
    await admin.from("billing_checkout_sessions").update({status:"pending",checkout_url:checkoutUrl,provider_session_id:body?.slug?String(body.slug):null,provider_payload:{request:checkoutPayload,response:body,pricing:{base_amount:baseAmount,final_amount:amount,savings,discount_percent:discountPercent,charge_type:chargeType,implementation_waived:implementationWaived,coupon:couponSnapshot}},updated_at:new Date().toISOString()}).eq("id",checkoutId);
    await admin.from("prepaid_purchase_intents").update({status:"pending_payment",updated_at:new Date().toISOString()}).eq("id",intentId);
    return json({checkout_url:checkoutUrl,purchase_id:intentId,status_token:statusToken,plan:{code:plan.code,name:plan.name},billing_cycle:billingCycle,charge_type:chargeType,implementation_waived:implementationWaived,base_amount:baseAmount,amount,savings,coupon:couponSnapshot});
  } catch (error) {
    const message=error instanceof Error?error.message:String(error);
    await admin.from("billing_checkout_sessions").update({status:"failed",provider_payload:{request:checkoutPayload,error:message,pricing:{base_amount:baseAmount,final_amount:amount,savings,discount_percent:discountPercent,charge_type:chargeType,implementation_waived:implementationWaived,coupon:couponSnapshot}},updated_at:new Date().toISOString()}).eq("id",checkoutId);
    await admin.from("prepaid_purchase_intents").update({status:"failed",invite_error:message,updated_at:new Date().toISOString()}).eq("id",intentId);
    return json({error:message},502);
  }
});
