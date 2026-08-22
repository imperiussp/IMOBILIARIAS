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

function normalizeReceivedAt(value: unknown, fallback: string) {
  const raw = clean(value, 80);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

const deliveryRank: Record<string, number> = { prepared: 0, sending: 1, sent: 2, delivered: 3, read: 4 };

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json({ error: "supabase_not_configured" }, 500);

  const supplied = request.headers.get("x-webhook-secret") || "";
  if (!webhookSecret || supplied !== webhookSecret) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const provider = clean(body.provider, 80) || "external";
  const attemptId = clean(body.attempt_id, 80);
  const eventId = clean(body.event_id, 240);
  const providerMessageId = clean(body.message_id, 240);
  const eventType = clean(body.event_type, 80).toLowerCase();
  const responseText = clean(body.response_text, 4000);
  if (!attemptId && !providerMessageId) return json({ error: "attempt_or_message_id_required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let attempt;
  if (attemptId) {
    attempt = await admin.from("buyer_outreach_delivery_attempts")
      .select("id,agency_id,opportunity_id,lead_id,property_id,channel,provider,status,provider_message_id")
      .eq("id", attemptId).maybeSingle();
  } else {
    attempt = await admin.from("buyer_outreach_delivery_attempts")
      .select("id,agency_id,opportunity_id,lead_id,property_id,channel,provider,status,provider_message_id")
      .eq("provider_message_id", providerMessageId)
      .order("attempted_at", { ascending: false })
      .limit(1).maybeSingle();
  }
  if (attempt.error) return json({ error: attempt.error.message }, 500);
  const row = attempt.data as any;
  if (!row) return json({ error: "delivery_attempt_not_found" }, 404);

  if (providerMessageId && row.provider_message_id && providerMessageId !== row.provider_message_id) {
    return json({ error: "provider_message_mismatch" }, 409);
  }

  const now = new Date().toISOString();
  if (["sent","delivered","read","failed"].includes(eventType)) {
    const current = String(row.status || "prepared");
    const patch: Record<string, unknown> = { provider_payload: body };
    let shouldUpdate = false;

    if (eventType === "failed") {
      if (!["delivered","read"].includes(current)) {
        patch.status = "failed";
        patch.error_message = clean(body.error, 1200) || "Falha informada pelo provedor.";
        shouldUpdate = true;
      }
    } else if ((deliveryRank[eventType] ?? -1) > (deliveryRank[current] ?? -1)) {
      patch.status = eventType;
      if (eventType === "sent") patch.sent_at = now;
      if (eventType === "delivered") patch.delivered_at = now;
      if (eventType === "read") { patch.read_at = now; patch.delivered_at = now; }
      shouldUpdate = true;
    }

    if (providerMessageId && !row.provider_message_id) {
      patch.provider_message_id = providerMessageId;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      const updateAttempt = await admin.from("buyer_outreach_delivery_attempts").update(patch).eq("id", row.id);
      if (updateAttempt.error) return json({ error: updateAttempt.error.message }, 500);
    }

    if (eventType === "failed" && !["delivered","read"].includes(current)) {
      const updateOpportunity = await admin.from("buyer_property_opportunities").update({ status: "failed", last_error: patch.error_message, updated_at: now }).eq("id", row.opportunity_id);
      if (updateOpportunity.error) return json({ error: updateOpportunity.error.message }, 500);
    }
  }

  if (["reply","interested","not_interested","request_details","request_visit","opt_out","other"].includes(eventType) || responseText) {
    const kind = ["interested","not_interested","request_details","request_visit","opt_out","other"].includes(eventType) ? eventType : "reply";
    const receivedAt = normalizeReceivedAt(body.received_at, now);
    const stableEventId = eventId || `${row.id}:${kind}:${receivedAt}:${responseText.slice(0,120)}`;
    const insert = await admin.from("buyer_outreach_responses").upsert({
      agency_id: row.agency_id,
      opportunity_id: row.opportunity_id,
      lead_id: row.lead_id,
      property_id: row.property_id,
      channel: row.channel,
      provider,
      provider_event_id: stableEventId,
      provider_message_id: providerMessageId || row.provider_message_id,
      response_text: responseText || null,
      response_kind: kind,
      received_at: receivedAt,
      provider_payload: body,
    }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
    if (insert.error) return json({ error: insert.error.message }, 500);
  }

  return json({ ok: true, attempt_id: row.id, event_type: eventType || "unknown" });
});
