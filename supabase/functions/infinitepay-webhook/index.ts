import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const expectedSecret = Deno.env.get("INFINITEPAY_WEBHOOK_SECRET") || "";
const handle = (Deno.env.get("INFINITEPAY_HANDLE") || "").replace(/^\$/, "").trim();
const siteUrl = (Deno.env.get("PLATFORM_SITE_URL") || "https://imoveis.lenoy.com.br").replace(/\/$/, "");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
function text(value: unknown, max = 500) { return String(value ?? "").trim().slice(0, max); }
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

async function findUserIdByEmail(admin: any, email: string) {
  for (let page = 1; page <= 5; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) return null;
    const found = result.data.users.find((user: any) => String(user.email || "").toLowerCase() === email.toLowerCase());
    if (found) return found.id as string;
    if (result.data.users.length < 200) break;
  }
  return null;
}

async function ensureOnboardingInvite(admin: any, intentId: string) {
  const { data: intent, error } = await admin.from("prepaid_purchase_intents")
    .select("id,email,status,invite_sent_at,auth_user_id")
    .eq("id", intentId)
    .maybeSingle();
  if (error || !intent) return { sent: false, error: "purchase_intent_not_found" };
  if (intent.invite_sent_at) return { sent: true, user_id: intent.auth_user_id || null };

  const onboardingToken = randomToken();
  const onboardingTokenHash = await sha256(onboardingToken);
  const redirectTo = `${siteUrl}/ativar-imobiliaria/?pedido=${encodeURIComponent(intent.id)}&token=${encodeURIComponent(onboardingToken)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const email = String(intent.email || "").trim().toLowerCase();
  let userId: string | null = null;
  let sendError = "";

  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    data: { onboarding_kind: "prepaid_owner", purchase_intent_id: intent.id },
    redirectTo,
  });
  if (!invite.error && invite.data.user) {
    userId = invite.data.user.id;
  } else if (anonKey) {
    const existingId = await findUserIdByEmail(admin, email);
    if (existingId) {
      const publicClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
      const otp = await publicClient.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
      if (!otp.error) userId = existingId;
      else sendError = otp.error.message;
    } else {
      sendError = invite.error?.message || "Não foi possível enviar o convite.";
    }
  } else {
    sendError = invite.error?.message || "Não foi possível enviar o convite.";
  }

  if (!userId) {
    await admin.from("prepaid_purchase_intents").update({
      status: "paid",
      onboarding_token_hash: onboardingTokenHash,
      onboarding_expires_at: expiresAt,
      invite_error: sendError || "Falha ao enviar o e-mail de ativação.",
      updated_at: new Date().toISOString(),
    }).eq("id", intent.id);
    return { sent: false, error: sendError || "invite_failed" };
  }

  await admin.from("prepaid_purchase_intents").update({
    status: "invite_sent",
    onboarding_token_hash: onboardingTokenHash,
    onboarding_expires_at: expiresAt,
    invite_sent_at: new Date().toISOString(),
    invite_error: null,
    auth_user_id: userId,
    updated_at: new Date().toISOString(),
  }).eq("id", intent.id);
  return { sent: true, user_id: userId };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ success: false, message: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey || !expectedSecret || !handle) return json({ success: false, message: "server_not_configured" }, 500);

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
  if (!orderNsu || !transactionNsu || !invoiceSlug) return json({ success: false, message: "invalid_payment_payload" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: checkout, error: checkoutError } = await admin.from("billing_checkout_sessions")
    .select("id,agency_id,purchase_intent_id,plan_id,status,amount,currency,billing_cycle,transaction_nsu,activated_subscription_id")
    .eq("provider", "infinitepay")
    .eq("order_nsu", orderNsu)
    .maybeSingle();
  if (checkoutError || !checkout) return json({ success: false, message: "order_not_found" }, 400);

  if (checkout.status === "paid") {
    if (checkout.transaction_nsu && checkout.transaction_nsu !== transactionNsu) return json({ success: false, message: "transaction_conflict" }, 400);
    if (checkout.purchase_intent_id) {
      const invite = await ensureOnboardingInvite(admin, checkout.purchase_intent_id);
      return json({ success: true, message: invite.sent ? null : "payment_confirmed_invite_pending" });
    }
    if (checkout.activated_subscription_id) return json({ success: true, message: null });
  }

  let verificationBody: any = null;
  try {
    const verificationResponse = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle, order_nsu: orderNsu, transaction_nsu: transactionNsu, slug: invoiceSlug }),
    });
    verificationBody = await verificationResponse.json().catch(() => null);
    if (!verificationResponse.ok || verificationBody?.success !== true || verificationBody?.paid !== true) {
      throw new Error(verificationBody?.message || verificationBody?.error || `InfinitePay HTTP ${verificationResponse.status}`);
    }
  } catch (error) {
    await admin.from("billing_events").upsert({
      provider: "infinitepay", provider_event_id: transactionNsu, agency_id: checkout.agency_id,
      event_type: "payment_verification_failed", payload: { webhook: payload, verification: verificationBody },
      processing_status: "failed", last_error: error instanceof Error ? error.message : String(error),
    }, { onConflict: "provider,provider_event_id" });
    return json({ success: false, message: "payment_verification_failed" }, 400);
  }

  const expectedAmountCents = Math.round(Number(checkout.amount || 0) * 100);
  const verifiedAmountCents = Math.round(Number(verificationBody?.amount || verificationBody?.paid_amount || 0));
  if (expectedAmountCents <= 0 || verifiedAmountCents !== expectedAmountCents) {
    await admin.from("billing_events").upsert({
      provider: "infinitepay", provider_event_id: transactionNsu, agency_id: checkout.agency_id,
      event_type: "payment_amount_mismatch", payload: { webhook: payload, verification: verificationBody },
      processing_status: "failed", last_error: `Valor esperado ${expectedAmountCents}; confirmado ${verifiedAmountCents}`,
    }, { onConflict: "provider,provider_event_id" });
    return json({ success: false, message: "amount_mismatch" }, 400);
  }
  if (checkout.transaction_nsu && checkout.transaction_nsu !== transactionNsu) return json({ success: false, message: "transaction_conflict" }, 400);

  const eventResult = await admin.from("billing_events").upsert({
    provider: "infinitepay", provider_event_id: transactionNsu, agency_id: checkout.agency_id,
    event_type: checkout.purchase_intent_id ? "prepaid_payment_approved" : "payment_approved",
    payload: { webhook: payload, verification: verificationBody }, processing_status: "processing", last_error: null,
  }, { onConflict: "provider,provider_event_id" }).select("id,processing_status").single();
  if (eventResult.error) return json({ success: false, message: "event_storage_failed" }, 400);
  if (eventResult.data?.processing_status === "processed") return json({ success: true, message: null });

  const paidAmount = verifiedAmountCents / 100;
  const paymentUpdate = await admin.from("billing_checkout_sessions").update({
    status: "paid", completed_at: new Date().toISOString(), transaction_nsu: transactionNsu, invoice_slug: invoiceSlug,
    receipt_url: receiptUrl || null, capture_method: verificationBody?.capture_method || captureMethod || null,
    paid_amount: paidAmount, provider_payload: { webhook: payload, payment_check: verificationBody }, updated_at: new Date().toISOString(),
  }).eq("id", checkout.id);
  if (paymentUpdate.error) {
    await admin.from("billing_events").update({ processing_status: "failed", last_error: paymentUpdate.error.message }).eq("provider", "infinitepay").eq("provider_event_id", transactionNsu);
    return json({ success: false, message: "payment_update_failed" }, 400);
  }

  if (checkout.purchase_intent_id) {
    await admin.from("prepaid_purchase_intents").update({ status: "paid", paid_at: new Date().toISOString(), invite_error: null, updated_at: new Date().toISOString() }).eq("id", checkout.purchase_intent_id);
    const invite = await ensureOnboardingInvite(admin, checkout.purchase_intent_id);
    await admin.from("billing_events").update({ processing_status: "processed", processed_at: new Date().toISOString(), last_error: invite.sent ? null : String(invite.error || "invite_pending") }).eq("provider", "infinitepay").eq("provider_event_id", transactionNsu);
    return json({ success: true, message: invite.sent ? null : "payment_confirmed_invite_pending" });
  }

  const activation = await admin.rpc("activate_subscription_from_paid_checkout", { p_checkout_id: checkout.id });
  if (activation.error) {
    await admin.from("billing_events").update({ processing_status: "failed", last_error: activation.error.message }).eq("provider", "infinitepay").eq("provider_event_id", transactionNsu);
    return json({ success: false, message: "subscription_activation_failed" }, 400);
  }
  await admin.from("billing_events").update({ processing_status: "processed", processed_at: new Date().toISOString(), last_error: null }).eq("provider", "infinitepay").eq("provider_event_id", transactionNsu);
  return json({ success: true, message: null, subscription_id: activation.data });
});
