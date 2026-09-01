import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const handle = (Deno.env.get("INFINITEPAY_HANDLE") || "robsonmasselli").replace(/^\$/, "").trim();
const siteUrl = (Deno.env.get("PLATFORM_SITE_URL") || "https://imoveis.lenoy.com.br").replace(/\/$/, "");
const configuredWebhookSecret = (Deno.env.get("INFINITEPAY_WEBHOOK_SECRET") || "").trim();
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8" } }); }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
async function sha256(value: string) { const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function webhookSecret() { if (configuredWebhookSecret) return configuredWebhookSecret; if (!serviceRoleKey) return ""; return sha256(`lenoy-infinitepay-webhook:${serviceRoleKey}`); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "supabase_not_configured" }, 500);
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const allowed = await admin.rpc("platform_runtime_action_allowed", { p_action: "billing" });
  if (allowed.error) return json({ error: "release_controls_unavailable" }, 503);
  if (allowed.data !== true) return json({ error: "billing_blocked_by_release_control" }, 423);
  const secret = await webhookSecret();

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const agencyId = String(payload.agency_id || "").trim();
  const planId = String(payload.plan_id || "").trim();
  const billingCycle = payload.billing_cycle === "annual" ? "annual" : "monthly";
  const returnPath = payload.return_path === "/app/" ? "/app/" : "/admin/";
  if (!agencyId || !planId) return json({ error: "agency_and_plan_required" }, 400);

  const membership = await userClient.from("agency_memberships").select("role").eq("agency_id", agencyId).eq("user_id", userData.user.id).eq("active", true).maybeSingle();
  const platformAdmin = await userClient.rpc("is_platform_admin");
  const canManage = Boolean(membership.data && ["owner", "admin"].includes(membership.data.role)) || platformAdmin.data === true;
  if (!canManage) return json({ error: "agency_access_denied" }, 403);

  const [{ data: agency }, { data: plan }, { data: profile }] = await Promise.all([
    admin.from("agencies").select("id,name,email,status").eq("id", agencyId).single(),
    admin.from("subscription_plans").select("id,name,code,monthly_price,annual_price,implementation_fee,annual_discount_percent,features,active").eq("id", planId).single(),
    admin.from("agency_billing_profiles").select("implementation_status,billing_cycle").eq("agency_id", agencyId).maybeSingle(),
  ]);
  if (!agency || !plan || !plan.active) return json({ error: "agency_or_plan_not_found" }, 404);
  if (String(plan.features?.internal_only || "false").toLowerCase() === "true") return json({ error: "internal_plan_not_for_sale" }, 403);

  const implementationStatus = String(profile?.implementation_status || "pending");
  const firstMonthlyImplementation = billingCycle === "monthly" && !["paid", "waived"].includes(implementationStatus);
  const chargeType = firstMonthlyImplementation ? "implementation" : "subscription";
  const implementationWaived = billingCycle === "annual" && implementationStatus !== "paid";
  let baseAmount = chargeType === "implementation" ? numberValue(plan.implementation_fee) : numberValue(billingCycle === "annual" ? plan.annual_price : plan.monthly_price);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return json({ error: chargeType === "implementation" ? "implementation_price_not_configured" : "plan_price_not_configured" }, 409);
  baseAmount = Math.round(baseAmount * 100) / 100;

  let amount = baseAmount;
  let discountId: string | null = null;
  let discountPercent = 0;
  if (chargeType === "subscription") {
    const { data: discount } = await admin.from("agency_billing_discounts").select("id,base_amount,final_amount,discount_percent,valid_until,created_at").eq("agency_id", agencyId).eq("plan_id", planId).eq("billing_cycle", billingCycle).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const validUntil = discount?.valid_until ? new Date(discount.valid_until).getTime() : null;
    const discountValid = Boolean(discount && (!validUntil || validUntil > Date.now()));
    if (discountValid) {
      const final = numberValue(discount?.final_amount);
      if (final >= 0 && final < baseAmount) {
        amount = Math.round(final * 100) / 100;
        discountId = String(discount?.id || "") || null;
        discountPercent = numberValue(discount?.discount_percent);
      }
    }
  }

  if (chargeType === "subscription" && discountId && amount === 0) {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const orderNsu = sessionId;
    const created = await admin.from("billing_checkout_sessions").insert({
      id:sessionId, agency_id:agencyId, plan_id:planId, provider:"infinitepay", status:"paid", amount:0, paid_amount:0,
      base_amount:baseAmount, discount_percent:discountPercent, discount_id:discountId, charge_type:chargeType,
      implementation_waived:implementationWaived, currency:"BRL", billing_cycle:billingCycle, order_nsu:orderNsu,
      created_by:userData.user.id, completed_at:now,
      provider_payload:{ pricing:{ base_amount:baseAmount, final_amount:0, discount_percent:discountPercent, charge_type:chargeType, implementation_waived:implementationWaived, full_coupon:true } }
    });
    if (created.error) return json({ error: created.error.message }, 500);
    const activation = await admin.rpc("activate_subscription_from_paid_checkout", { p_checkout_id: sessionId });
    if (activation.error) {
      await admin.from("billing_checkout_sessions").update({status:"failed",updated_at:new Date().toISOString()}).eq("id",sessionId);
      return json({ error:"subscription_activation_failed" },500);
    }
    await admin.from("agency_billing_discounts").update({status:"consumed",consumed_at:now,updated_at:now}).eq("id",discountId).eq("status","active");
    return json({ checkout_url:`${siteUrl}${returnPath}?pagamento=retorno&cupom=100`, checkout_id:sessionId, order_nsu:orderNsu, reused:false, charge_type:chargeType, base_amount:baseAmount, amount:0, discount_percent:discountPercent, implementation_free:implementationWaived, full_discount:true, subscription_id:activation.data });
  }

  if (!handle || !secret) return json({ error: "infinitepay_not_configured" }, 503);
  const reuseAfter = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const reusableQuery = admin.from("billing_checkout_sessions").select("id,order_nsu,checkout_url,created_at,amount").eq("agency_id", agencyId).eq("plan_id", planId).eq("provider", "infinitepay").eq("billing_cycle", billingCycle).eq("charge_type", chargeType).eq("amount", amount).eq("status", "pending").gte("created_at", reuseAfter).not("checkout_url", "is", null).order("created_at", { ascending: false }).limit(1);
  const { data: reusable } = await reusableQuery.maybeSingle();
  if (reusable?.checkout_url) return json({ checkout_url: reusable.checkout_url, checkout_id: reusable.id, order_nsu: reusable.order_nsu, reused: true, charge_type: chargeType, base_amount: baseAmount, amount, discount_percent: discountPercent, implementation_free: implementationWaived });

  await admin.from("billing_checkout_sessions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("agency_id", agencyId).eq("plan_id", planId).eq("provider", "infinitepay").eq("billing_cycle", billingCycle).eq("charge_type", chargeType).eq("status", "pending").lt("created_at", reuseAfter);

  const amountCents = Math.round(amount * 100);
  const sessionId = crypto.randomUUID();
  const orderNsu = sessionId;
  const redirectUrl = `${siteUrl}${returnPath}?pagamento=retorno`;
  const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook?secret=${encodeURIComponent(secret)}`;
  const description = chargeType === "implementation" ? `LENOY IMOBILIÁRIAS — Implantação · ${plan.name}` : `LENOY IMOBILIÁRIAS — ${plan.name} (${billingCycle === "annual" ? "anual" : "mensal"})`;
  const checkoutPayload = { handle, redirect_url: redirectUrl, webhook_url: webhookUrl, order_nsu: orderNsu, items: [{ quantity: 1, price: amountCents, description }], customer: { name: agency.name, email: userData.user.email || agency.email || undefined } };
  const created = await admin.from("billing_checkout_sessions").insert({ id:sessionId,agency_id:agencyId,plan_id:planId,provider:"infinitepay",status:"created",amount,base_amount:baseAmount,discount_percent:discountPercent,discount_id:discountId,charge_type:chargeType,implementation_waived:implementationWaived,currency:"BRL",billing_cycle:billingCycle,order_nsu:orderNsu,created_by:userData.user.id,provider_payload:{request:checkoutPayload,pricing:{base_amount:baseAmount,final_amount:amount,discount_percent:discountPercent,charge_type:chargeType,implementation_waived:implementationWaived}} });
  if (created.error) return json({ error: created.error.message }, 500);

  try {
    const response = await fetch("https://api.checkout.infinitepay.io/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(checkoutPayload) });
    const body = await response.json().catch(() => null);
    const checkoutUrl = String(body?.url || "").trim();
    if (!response.ok || !checkoutUrl) throw new Error(body?.message || body?.error || `InfinitePay HTTP ${response.status}`);
    await admin.from("billing_checkout_sessions").update({ status:"pending",checkout_url:checkoutUrl,provider_session_id:body?.slug?String(body.slug):null,provider_payload:{request:checkoutPayload,response:body,pricing:{base_amount:baseAmount,final_amount:amount,discount_percent:discountPercent,charge_type:chargeType,implementation_waived:implementationWaived}},updated_at:new Date().toISOString() }).eq("id",sessionId);
    return json({ checkout_url:checkoutUrl,checkout_id:sessionId,order_nsu:orderNsu,reused:false,charge_type:chargeType,base_amount:baseAmount,amount,discount_percent:discountPercent,implementation_free:implementationWaived });
  } catch (error) {
    await admin.from("billing_checkout_sessions").update({ status:"failed",provider_payload:{request:checkoutPayload,error:error instanceof Error?error.message:String(error),pricing:{base_amount:baseAmount,final_amount:amount,discount_percent:discountPercent,charge_type:chargeType,implementation_waived:implementationWaived}},updated_at:new Date().toISOString() }).eq("id",sessionId);
    return json({ error:error instanceof Error?error.message:String(error) },502);
  }
});
