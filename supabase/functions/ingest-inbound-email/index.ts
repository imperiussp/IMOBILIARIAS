import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const webhookSecret = Deno.env.get("INBOUND_EMAIL_SECRET") || "";
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function extractEmail(value: string) {
  const match = value.toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match?.[0] || value.toLowerCase().trim();
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!url || !serviceKey) return json({ error: "server_not_configured" }, 500);
  if (!webhookSecret || request.headers.get("x-inbound-secret") !== webhookSecret) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const toAddress = extractEmail(clean(body.to, 320));
  const fromAddress = extractEmail(clean(body.from, 320));
  const senderName = clean(body.from_name || body.name, 160);
  const subject = clean(body.subject, 300);
  const plainText = clean(body.text || body.body || body.plain, 8000);
  const providerMessageId = clean(body.message_id || body.messageId || body.id, 500);

  if (!toAddress || !fromAddress || !providerMessageId) return json({ error: "missing_required_fields" }, 400);

  const aliasResult = await supabase
    .from("agency_inbound_emails")
    .select("agency_id,broker_id,active")
    .eq("address", toAddress)
    .eq("active", true)
    .maybeSingle();
  if (aliasResult.error || !aliasResult.data) return json({ error: "unknown_recipient" }, 404);

  const duplicate = await supabase.from("inbound_email_events").select("lead_id").eq("provider_message_id", providerMessageId).maybeSingle();
  if (duplicate.data) return json({ duplicate: true, lead_id: duplicate.data.lead_id });

  const message = [subject ? `Assunto: ${subject}` : "", plainText].filter(Boolean).join("\n\n").trim();
  const leadResult = await supabase.from("leads").insert({
    agency_id: aliasResult.data.agency_id,
    broker_id: aliasResult.data.broker_id || null,
    name: senderName || fromAddress.split("@")[0] || "Contato por e-mail",
    phone: null,
    email: fromAddress,
    message: message || "Contato recebido por e-mail.",
    source: "email",
  }).select("id").single();

  if (leadResult.error) return json({ error: leadResult.error.message }, 500);

  const eventResult = await supabase.from("inbound_email_events").insert({
    provider_message_id: providerMessageId,
    agency_id: aliasResult.data.agency_id,
    lead_id: leadResult.data.id,
  });

  if (eventResult.error && eventResult.error.code === "23505") {
    await supabase.from("leads").delete().eq("id", leadResult.data.id);
    const existing = await supabase.from("inbound_email_events").select("lead_id").eq("provider_message_id", providerMessageId).single();
    return json({ duplicate: true, lead_id: existing.data?.lead_id || null });
  }
  if (eventResult.error) return json({ error: eventResult.error.message, lead_id: leadResult.data.id }, 500);

  return json({ ok: true, lead_id: leadResult.data.id, agency_id: aliasResult.data.agency_id });
});
