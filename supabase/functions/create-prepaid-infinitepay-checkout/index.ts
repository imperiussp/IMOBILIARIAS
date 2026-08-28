import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const handle = (Deno.env.get("INFINITEPAY_HANDLE") || "").replace(/^\$/, "").trim();
const siteUrl = (Deno.env.get("PLATFORM_SITE_URL") || "https://imoveis.lenoy.com.br").replace(/\/$/, "");
const webhookSecret = Deno.env.get("INFINITEPAY_WEBHOOK_SECRET") || "";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8" } });
}
function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let raw = "";
  for (const byte of data) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "supabase_not_configured" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const allowed = await admin.rpc("platform_runtime_action_allowed", { p_action: "billing" });
  if (allowed.error) return json({ error: "release_controls_unavailable" }, 503);
  if (allowed.data !== true) return json({ error: "billing_blocked_by_release_control" }, 423);
  if (!handle || !webhookSecret) return json({ error: "infinitepay_not_configured" }, 503);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const email = String(payload.email || "").trim().toLowerCase();
  const planCode = String(payload.plan_code || "").trim().toLowerCase();
  const billingCycle = payload.billing_cycle === "annual" ? "annual" : "monthly";
  if (!validEmail(email)) return json({ error: "valid_email_required" }, 400);
  if (!planCode) return json({ error: "plan_required" }, 400);

  const { data: plan, error: planError } = await admin.from("subscription_plans")
    .select("id,code,name,monthly_price,annual_price,implementation_fee,features,active")
    .eq("code", planCode)
    .eq("active", true)
    .maybeSingle();
  if (planError || !plan) return json({ error: "plan_not_found" }, 404);
  if (String(plan.features?.internal_only || "false").toLowerCase() === "true") return json({ error: "internal_plan_not_for_sale" }, 403);

  const implementationFee = Math.round(numberValue(plan.implementation_fee) * 100) / 100;
  const implementationWaived = billingCycle === "annual" || implementationFee <= 0;
  const chargeType = billingCycle === "annual" || implementationWaived ? "subscription" : "implementation";
  const rawAmount = billingCycle === "annual"
    ? plan.annual_price
    : implementationWaived
      ? plan.monthly_price
      : plan.implementation_fee;
  const baseAmount = Math.round(numberValue(rawAmount) * 100) / 100;
  if (baseAmount <= 0) return json({ error: "plan_price_not_configured" }, 409);

  const statusToken = randomToken();
  const statusTokenHash = await sha256(statusToken);
  const intentId = crypto.randomUUID();
  const checkoutId = crypto.randomUUID();
  const orderNsu = checkoutId;
  const redirectParams = new URLSearchParams({ pedido: intentId, token: statusToken });
  const redirectUrl = `${siteUrl}/pagamento/retorno/?${redirectParams.toString()}`;
  const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook?secret=${encodeURIComponent(webhookSecret)}`;
  const description = billingCycle === "annual"
    ? `LENOY IMOBILIÁRIAS — ${plan.name} (anual)`
    : implementationWaived
      ? `LENOY IMOBILIÁRIAS — ${plan.name} (mensal)`
      : `LENOY IMOBILIÁRIAS — Implantação · ${plan.name}`;
  const checkoutPayload = {
    handle,
    redirect_url: redirectUrl,
    webhook_url: webhookUrl,
    order_nsu: orderNsu,
    items: [{ quantity: 1, price: Math.round(baseAmount * 100), description }],
    customer: { name: "Cliente LENOY", email },
  };

  const intentInsert = await admin.from("prepaid_purchase_intents").insert({
    id: intentId,
    email,
    plan_id: plan.id,
    billing_cycle: billingCycle,
    charge_type: chargeType,
    base_amount: baseAmount,
    amount: baseAmount,
    currency: "BRL",
    status: "created",
    public_status_token_hash: statusTokenHash,
  });
  if (intentInsert.error) return json({ error: intentInsert.error.message }, 500);

  const checkoutInsert = await admin.from("billing_checkout_sessions").insert({
    id: checkoutId,
    agency_id: null,
    purchase_intent_id: intentId,
    plan_id: plan.id,
    provider: "infinitepay",
    status: "created",
    amount: baseAmount,
    base_amount: baseAmount,
    discount_percent: 0,
    discount_id: null,
    charge_type: chargeType,
    implementation_waived: implementationWaived,
    currency: "BRL",
    billing_cycle: billingCycle,
    order_nsu: orderNsu,
    created_by: null,
    provider_payload: { request: checkoutPayload, pricing: { base_amount: baseAmount, final_amount: baseAmount, charge_type: chargeType, implementation_waived: implementationWaived } },
  });
  if (checkoutInsert.error) {
    await admin.from("prepaid_purchase_intents").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", intentId);
    return json({ error: checkoutInsert.error.message }, 500);
  }
  await admin.from("prepaid_purchase_intents").update({ checkout_id: checkoutId, updated_at: new Date().toISOString() }).eq("id", intentId);

  try {
    const response = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(checkoutPayload),
    });
    const body = await response.json().catch(() => null);
    const checkoutUrl = String(body?.url || "").trim();
    if (!response.ok || !checkoutUrl) throw new Error(body?.message || body?.error || `InfinitePay HTTP ${response.status}`);

    await admin.from("billing_checkout_sessions").update({
      status: "pending",
      checkout_url: checkoutUrl,
      provider_session_id: body?.slug ? String(body.slug) : null,
      provider_payload: { request: checkoutPayload, response: body, pricing: { base_amount: baseAmount, final_amount: baseAmount, charge_type: chargeType, implementation_waived: implementationWaived } },
      updated_at: new Date().toISOString(),
    }).eq("id", checkoutId);
    await admin.from("prepaid_purchase_intents").update({ status: "pending_payment", updated_at: new Date().toISOString() }).eq("id", intentId);

    return json({
      checkout_url: checkoutUrl,
      purchase_id: intentId,
      status_token: statusToken,
      plan: { code: plan.code, name: plan.name },
      billing_cycle: billingCycle,
      charge_type: chargeType,
      implementation_waived: implementationWaived,
      amount: baseAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("billing_checkout_sessions").update({ status: "failed", provider_payload: { request: checkoutPayload, error: message }, updated_at: new Date().toISOString() }).eq("id", checkoutId);
    await admin.from("prepaid_purchase_intents").update({ status: "failed", invite_error: message, updated_at: new Date().toISOString() }).eq("id", intentId);
    return json({ error: message }, 502);
  }
});
