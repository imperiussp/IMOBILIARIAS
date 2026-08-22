const internalToken = Deno.env.get("BUYER_OUTREACH_WEBHOOK_TOKEN") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function has(name: string) {
  return Boolean((Deno.env.get(name) || "").trim());
}

Deno.serve((request) => {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!internalToken || supplied !== internalToken) return json({ error: "unauthorized" }, 401);

  const whatsapp = {
    configured: has("META_WHATSAPP_ACCESS_TOKEN") && has("META_WHATSAPP_PHONE_NUMBER_ID") && has("META_GRAPH_API_VERSION"),
    access_token: has("META_WHATSAPP_ACCESS_TOKEN"),
    phone_number_id: has("META_WHATSAPP_PHONE_NUMBER_ID"),
    graph_version: has("META_GRAPH_API_VERSION"),
    webhook_verify_token: has("META_WHATSAPP_VERIFY_TOKEN"),
    app_secret: has("META_WHATSAPP_APP_SECRET"),
  };

  const email = {
    configured: has("RESEND_API_KEY") && has("RESEND_FROM_EMAIL"),
    api_key: has("RESEND_API_KEY"),
    from_email: has("RESEND_FROM_EMAIL"),
  };

  const processing = {
    configured: has("BUYER_OUTREACH_MAINTENANCE_SECRET") && has("BUYER_OUTREACH_WEBHOOK_URL") && has("BUYER_OUTREACH_WEBHOOK_TOKEN"),
    maintenance_secret: has("BUYER_OUTREACH_MAINTENANCE_SECRET"),
    delivery_url: has("BUYER_OUTREACH_WEBHOOK_URL"),
    delivery_token: has("BUYER_OUTREACH_WEBHOOK_TOKEN"),
    provider_webhook_secret: has("BUYER_OUTREACH_PROVIDER_WEBHOOK_SECRET"),
  };

  return json({
    ok: true,
    whatsapp,
    email,
    processing,
    ready_for_whatsapp: whatsapp.configured && processing.configured,
    ready_for_email: email.configured && processing.configured,
  });
});
