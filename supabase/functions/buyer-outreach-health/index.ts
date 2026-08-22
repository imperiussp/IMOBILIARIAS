import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const internalToken = Deno.env.get("BUYER_OUTREACH_WEBHOOK_TOKEN") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function has(name: string) {
  return Boolean((Deno.env.get(name) || "").trim());
}

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!internalToken || supplied !== internalToken) return json({ error: "unauthorized" }, 401);

  const whatsapp = {
    configured: has("META_WHATSAPP_ACCESS_TOKEN") && has("META_WHATSAPP_PHONE_NUMBER_ID") && has("META_GRAPH_API_VERSION"),
    access_token: has("META_WHATSAPP_ACCESS_TOKEN"),
    phone_number_id: has("META_WHATSAPP_PHONE_NUMBER_ID"),
    graph_version: has("META_GRAPH_API_VERSION"),
    webhook_configured: has("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN") && has("META_APP_SECRET"),
    webhook_verify_token: has("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    app_secret: has("META_APP_SECRET"),
  };

  const email = {
    configured: has("RESEND_API_KEY") && has("RESEND_FROM_EMAIL"),
    api_key: has("RESEND_API_KEY"),
    from_email: has("RESEND_FROM_EMAIL"),
    webhook_configured: has("RESEND_WEBHOOK_SIGNING_SECRET"),
    webhook_signing_secret: has("RESEND_WEBHOOK_SIGNING_SECRET"),
    inbound_configured: has("INBOUND_EMAIL_SECRET"),
  };

  const processing = {
    configured: has("BUYER_OUTREACH_MAINTENANCE_SECRET") && has("BUYER_OUTREACH_WEBHOOK_URL") && has("BUYER_OUTREACH_WEBHOOK_TOKEN"),
    maintenance_secret: has("BUYER_OUTREACH_MAINTENANCE_SECRET"),
    delivery_url: has("BUYER_OUTREACH_WEBHOOK_URL"),
    delivery_token: has("BUYER_OUTREACH_WEBHOOK_TOKEN"),
    provider_webhook_secret: has("BUYER_OUTREACH_PROVIDER_WEBHOOK_SECRET"),
    platform_maintenance_secret: has("PLATFORM_MAINTENANCE_SECRET"),
    supabase_service_role: has("SUPABASE_SERVICE_ROLE_KEY"),
  };

  let release = {
    available: false,
    environment_mode: "unknown",
    maintenance_mode: false,
    messaging_allowed: false,
    ai_allowed: false,
  };

  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const [controls,messagingGate,aiGate] = await Promise.all([
      admin.from("platform_release_controls").select("environment_mode,maintenance_mode").eq("id",1).maybeSingle(),
      admin.rpc("platform_runtime_action_allowed", { p_action: "messaging" }),
      admin.rpc("platform_runtime_action_allowed", { p_action: "ai" }),
    ]);
    if (!controls.error && controls.data && !messagingGate.error && !aiGate.error) {
      release = {
        available: true,
        environment_mode: String(controls.data.environment_mode || "unknown"),
        maintenance_mode: controls.data.maintenance_mode === true,
        messaging_allowed: messagingGate.data === true,
        ai_allowed: aiGate.data === true,
      };
    }
  }

  const whatsappReady = whatsapp.configured && whatsapp.webhook_configured && processing.configured;
  const emailReady = email.configured && email.webhook_configured && email.inbound_configured && processing.configured;

  return json({
    ok: true,
    whatsapp,
    email,
    processing,
    release,
    configured_for_whatsapp: whatsappReady,
    configured_for_email: emailReady,
    ready_for_whatsapp: whatsappReady && release.available && release.messaging_allowed,
    ready_for_email: emailReady && release.available && release.messaging_allowed,
    ready_for_ai_generation: has("AI_API_URL") && has("AI_API_KEY") && has("AI_MODEL") && release.available && release.ai_allowed,
  });
});
