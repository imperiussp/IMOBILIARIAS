import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const handle = (Deno.env.get("INFINITEPAY_HANDLE") || "").replace(/^\$/, "").trim();
const siteUrl = (Deno.env.get("PLATFORM_SITE_URL") || "https://imoveis.lenoy.com.br").replace(/\/$/, "");
const webhookSecret = Deno.env.get("INFINITEPAY_WEBHOOK_SECRET") || "";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "supabase_not_configured" }, 500);
  if (!handle || !webhookSecret) return json({ error: "infinitepay_not_configured" }, 503);

  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const agencyId = String(payload.agency_id || "").trim();
  const planId = String(payload.plan_id || "").trim();
  const billingCycle = payload.billing_cycle === "annual" ? "annual" : "monthly";
  if (!agencyId || !planId) return json({ error: "agency_and_plan_required" }, 400);

  const membership = await userClient.from("agency_memberships").select("role").eq("agency_id", agencyId).eq("user_id", userData.user.id).eq("active", true).maybeSingle();
  const platformAdmin = await userClient.rpc("is_platform_admin");
  const canManage = Boolean(membership.data && ["owner", "admin"].includes(membership.data.role)) || platformAdmin.data === true;
  if (!canManage) return json({ error: "agency_access_denied" }, 403);

  const [{ data: agency }, { data: plan }] = await Promise.all([
    admin.from("agencies").select("id,name,email,status").eq("id", agencyId).single(),
    admin.from("subscription_plans").select("id,name,monthly_price,annual_price,active").eq("id", planId).single(),
  ]);
  if (!agency || !plan || !plan.active) return json({ error: "agency_or_plan_not_found" }, 404);

  const amount = Number(billingCycle === "annual" ? plan.annual_price : plan.monthly_price);
  if (!Number.isFinite(amount) || amount <= 0) return json({ error: "plan_price_not_configured" }, 409);
  const amountCents = Math.round(amount * 100);
  const sessionId = crypto.randomUUID();
  const orderNsu = sessionId;
  const redirectUrl = `${siteUrl}/admin/?pagamento=retorno`;
  const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook?secret=${encodeURIComponent(webhookSecret)}`;
  const checkoutPayload = {
    handle,
    redirect_url: redirectUrl,
    webhook_url: webhookUrl,
    order_nsu: orderNsu,
    items: [{ quantity: 1, price: amountCents, description: `LENOY IMÓVEIS — ${plan.name} (${billingCycle === "annual" ? "anual" : "mensal"})` }],
    customer: { name: agency.name, email: userData.user.email || agency.email || undefined },
  };

  const created = await admin.from("billing_checkout_sessions").insert({ id: sessionId, agency_id: agencyId, plan_id: planId, provider: "infinitepay", status: "created", amount, currency: "BRL", billing_cycle: billingCycle, order_nsu: orderNsu, created_by: userData.user.id, provider_payload: { request: checkoutPayload } });
  if (created.error) return json({ error: created.error.message }, 500);

  try {
    const response = await fetch("https://api.checkout.infinitepay.io/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(checkoutPayload) });
    const body = await response.json().catch(() => null);
    const checkoutUrl = String(body?.url || "").trim();
    if (!response.ok || !checkoutUrl) throw new Error(body?.message || body?.error || `InfinitePay HTTP ${response.status}`);
    await admin.from("billing_checkout_sessions").update({ status: "pending", checkout_url: checkoutUrl, provider_session_id: body?.slug ? String(body.slug) : null, provider_payload: { request: checkoutPayload, response: body }, updated_at: new Date().toISOString() }).eq("id", sessionId);
    return json({ checkout_url: checkoutUrl, checkout_id: sessionId, order_nsu: orderNsu });
  } catch (error) {
    await admin.from("billing_checkout_sessions").update({ status: "failed", provider_payload: { request: checkoutPayload, error: error instanceof Error ? error.message : String(error) }, updated_at: new Date().toISOString() }).eq("id", sessionId);
    return json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
});
