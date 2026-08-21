import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const handle = (Deno.env.get("INFINITEPAY_HANDLE") || "").replace(/^\$/, "").trim();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function text(value: unknown, max = 1000) { return String(value ?? "").trim().slice(0, max); }

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !handle) return json({ error: "server_not_configured" }, 503);

  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: "unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const orderNsu = text(payload.order_nsu, 120);
  const transactionNsu = text(payload.transaction_nsu, 160);
  const slug = text(payload.slug, 160);
  const receiptUrl = text(payload.receipt_url, 1000);
  const captureMethod = text(payload.capture_method, 60);
  if (!orderNsu || !transactionNsu || !slug) return json({ error: "payment_identifiers_required" }, 400);

  const { data: checkout } = await admin.from("billing_checkout_sessions")
    .select("id,agency_id,status,amount,transaction_nsu")
    .eq("provider", "infinitepay").eq("order_nsu", orderNsu).maybeSingle();
  if (!checkout) return json({ error: "checkout_not_found" }, 404);

  const membership = await userClient.from("agency_memberships").select("role").eq("agency_id", checkout.agency_id).eq("user_id", userData.user.id).eq("active", true).maybeSingle();
  const platformAdmin = await userClient.rpc("is_platform_admin");
  if (!(membership.data && ["owner", "admin"].includes(membership.data.role)) && platformAdmin.data !== true) return json({ error: "agency_access_denied" }, 403);

  if (checkout.status === "paid") return json({ paid: true, checkout_id: checkout.id });

  const response = await fetch("https://api.checkout.infinitepay.io/payment_check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle, order_nsu: orderNsu, transaction_nsu: transactionNsu, slug }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) return json({ error: body?.message || body?.error || `InfinitePay HTTP ${response.status}` }, 502);
  if (body?.paid !== true) return json({ paid: false, status: "pending" });

  const expectedAmountCents = Math.round(Number(checkout.amount || 0) * 100);
  if (Math.round(Number(body.amount || 0)) !== expectedAmountCents) return json({ error: "amount_mismatch" }, 409);
  if (checkout.transaction_nsu && checkout.transaction_nsu !== transactionNsu) return json({ error: "transaction_conflict" }, 409);

  await admin.from("billing_checkout_sessions").update({
    status: "paid",
    completed_at: new Date().toISOString(),
    transaction_nsu: transactionNsu,
    invoice_slug: slug,
    receipt_url: receiptUrl || null,
    capture_method: body.capture_method || captureMethod || null,
    paid_amount: Number(body.paid_amount || body.amount || 0) / 100,
    provider_payload: { payment_check: body },
    updated_at: new Date().toISOString(),
  }).eq("id", checkout.id);

  const activation = await admin.rpc("activate_subscription_from_paid_checkout", { p_checkout_id: checkout.id });
  if (activation.error) return json({ error: activation.error.message }, 500);

  await admin.from("billing_events").upsert({
    provider: "infinitepay",
    provider_event_id: transactionNsu,
    agency_id: checkout.agency_id,
    event_type: "payment_confirmed",
    payload: body,
    processing_status: "processed",
    processed_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: "provider,provider_event_id" });

  return json({ paid: true, checkout_id: checkout.id, subscription_id: activation.data });
});
