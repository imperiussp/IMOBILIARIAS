import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const expectedSecret = Deno.env.get("INFINITEPAY_WEBHOOK_SECRET") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function text(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ success: false, message: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey || !expectedSecret) return json({ success: false, message: "server_not_configured" }, 500);

  const url = new URL(request.url);
  const suppliedSecret = url.searchParams.get("secret") || "";
  if (!suppliedSecret || suppliedSecret !== expectedSecret) return json({ success: false, message: "unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ success: false, message: "invalid_json" }, 400); }

  const orderNsu = text(payload.order_nsu, 120);
  const transactionNsu = text(payload.transaction_nsu, 160);
  const invoiceSlug = text(payload.invoice_slug || payload.slug, 160);
  const receiptUrl = text(payload.receipt_url, 1000);
  const captureMethod = text(payload.capture_method, 60);
  const amountCents = Number(payload.amount);
  const paidAmountCents = Number(payload.paid_amount ?? payload.amount);

  if (!orderNsu || !transactionNsu || !Number.isFinite(amountCents) || amountCents <= 0) {
    return json({ success: false, message: "invalid_payment_payload" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: checkout, error: checkoutError } = await admin.from("billing_checkout_sessions")
    .select("id,agency_id,plan_id,status,amount,currency,billing_cycle,transaction_nsu")
    .eq("provider", "infinitepay")
    .eq("order_nsu", orderNsu)
    .maybeSingle();

  if (checkoutError || !checkout) return json({ success: false, message: "order_not_found" }, 400);

  const expectedAmountCents = Math.round(Number(checkout.amount || 0) * 100);
  if (expectedAmountCents !== Math.round(amountCents)) {
    await admin.from("billing_events").upsert({
      provider: "infinitepay",
      provider_event_id: transactionNsu,
      agency_id: checkout.agency_id,
      event_type: "payment_amount_mismatch",
      payload,
      processing_status: "failed",
      last_error: `Valor esperado ${expectedAmountCents}; recebido ${amountCents}`,
    }, { onConflict: "provider,provider_event_id" });
    return json({ success: false, message: "amount_mismatch" }, 400);
  }

  if (checkout.status === "paid") {
    if (checkout.transaction_nsu && checkout.transaction_nsu !== transactionNsu) {
      return json({ success: false, message: "transaction_conflict" }, 400);
    }
    return json({ success: true, message: null });
  }

  const eventResult = await admin.from("billing_events").upsert({
    provider: "infinitepay",
    provider_event_id: transactionNsu,
    agency_id: checkout.agency_id,
    event_type: "payment_approved",
    payload,
    processing_status: "processing",
    last_error: null,
  }, { onConflict: "provider,provider_event_id" }).select("id,processing_status").single();

  if (eventResult.error) return json({ success: false, message: "event_storage_failed" }, 400);
  if (eventResult.data?.processing_status === "processed") return json({ success: true, message: null });

  const paidAmount = Number.isFinite(paidAmountCents) ? paidAmountCents / 100 : amountCents / 100;
  const { error: paymentUpdateError } = await admin.from("billing_checkout_sessions").update({
    status: "paid",
    completed_at: new Date().toISOString(),
    transaction_nsu: transactionNsu,
    invoice_slug: invoiceSlug || null,
    receipt_url: receiptUrl || null,
    capture_method: captureMethod || null,
    paid_amount: paidAmount,
    provider_payload: { webhook: payload },
    updated_at: new Date().toISOString(),
  }).eq("id", checkout.id).neq("status", "paid");

  if (paymentUpdateError) {
    await admin.from("billing_events").update({ processing_status: "failed", last_error: paymentUpdateError.message }).eq("provider", "infinitepay").eq("provider_event_id", transactionNsu);
    return json({ success: false, message: "payment_update_failed" }, 400);
  }

  const activation = await admin.rpc("activate_subscription_from_paid_checkout", { p_checkout_id: checkout.id });
  if (activation.error) {
    await admin.from("billing_events").update({ processing_status: "failed", last_error: activation.error.message }).eq("provider", "infinitepay").eq("provider_event_id", transactionNsu);
    return json({ success: false, message: "subscription_activation_failed" }, 400);
  }

  await admin.from("billing_events").update({
    processing_status: "processed",
    processed_at: new Date().toISOString(),
    last_error: null,
  }).eq("provider", "infinitepay").eq("provider_event_id", transactionNsu);

  return json({ success: true, message: null });
});
