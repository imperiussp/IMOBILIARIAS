import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const webhookSecret = Deno.env.get("BUYER_OUTREACH_PROVIDER_WEBHOOK_SECRET") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function clean(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json({ error: "supabase_not_configured" }, 500);

  const supplied = request.headers.get("x-webhook-secret") || new URL(request.url).searchParams.get("secret") || "";
  if (!webhookSecret || supplied !== webhookSecret) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const provider = clean(body.provider, 80) || "external";
  const eventId = clean(body.event_id, 240);
  const providerMessageId = clean(body.message_id, 240);
  const eventType = clean(body.event_type, 80).toLowerCase();
  const responseText = clean(body.response_text, 4000);
  if (!providerMessageId && !eventId) return json({ error: "message_or_event_id_required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const attemptQuery = admin.from("buyer_outreach_delivery_attempts")
    .select("id,agency_id,opportunity_id,lead_id,property_id,channel,provider_message_id")
    .order("attempted_at", { ascending: false })
    .limit(1);
  const attempt = providerMessageId
    ? await attemptQuery.eq("provider_message_id", providerMessageId).maybeSingle()
    : { data: null, error: null } as any;

  const row = attempt.data as any;
  if (!row) return json({ error: "delivery_attempt_not_found" }, 404);

  const now = new Date().toISOString();
  if (["delivered","read","failed"].includes(eventType)) {
    const patch: Record<string, unknown> = { status: eventType, provider_payload: body };
    if (eventType === "delivered") patch.delivered_at = now;
    if (eventType === "read") { patch.read_at = now; patch.delivered_at = now; }
    if (eventType === "failed") patch.error_message = clean(body.error, 1200) || "Falha informada pelo provedor.";
    await admin.from("buyer_outreach_delivery_attempts").update(patch).eq("id", row.id);
    if (eventType === "failed") {
      await admin.from("buyer_property_opportunities").update({ status: "failed", last_error: patch.error_message, updated_at: now }).eq("id", row.opportunity_id);
    }
  }

  if (["reply","interested","not_interested","request_details","request_visit","opt_out","other"].includes(eventType) || responseText) {
    const kind = ["interested","not_interested","request_details","request_visit","opt_out","other"].includes(eventType) ? eventType : "reply";
    const insert = await admin.from("buyer_outreach_responses").upsert({
      agency_id: row.agency_id,
      opportunity_id: row.opportunity_id,
      lead_id: row.lead_id,
      property_id: row.property_id,
      channel: row.channel,
      provider,
      provider_event_id: eventId || `${providerMessageId}:${kind}:${Date.now()}`,
      provider_message_id: providerMessageId || row.provider_message_id,
      response_text: responseText || null,
      response_kind: kind,
      received_at: clean(body.received_at, 80) || now,
      provider_payload: body,
    }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
    if (insert.error) return json({ error: insert.error.message }, 500);
  }

  return json({ ok: true, event_type: eventType || "unknown" });
});
