import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "npm:svix";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const signingSecret = Deno.env.get("RESEND_WEBHOOK_SIGNING_SECRET") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function clean(value: unknown, max = 1200) {
  return String(value ?? "").trim().slice(0, max);
}

function statusFromEvent(type: string) {
  if (type === "email.sent") return "sent";
  if (type === "email.delivered") return "delivered";
  if (["email.failed", "email.bounced", "email.complained", "email.suppressed"].includes(type)) return "failed";
  return null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !signingSecret) return json({ error: "server_not_configured" }, 503);

  const raw = await request.text();
  let event: any;
  try {
    const webhook = new Webhook(signingSecret);
    event = webhook.verify(raw, {
      "svix-id": request.headers.get("svix-id") || "",
      "svix-timestamp": request.headers.get("svix-timestamp") || "",
      "svix-signature": request.headers.get("svix-signature") || "",
    });
  } catch {
    return json({ error: "invalid_signature" }, 401);
  }

  const type = clean(event?.type, 80);
  const providerMessageId = clean(event?.data?.email_id, 240);
  if (!providerMessageId) return json({ ignored: true, reason: "missing_email_id" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const attemptResult = await admin.from("buyer_outreach_delivery_attempts")
    .select("id,opportunity_id,status")
    .eq("provider_message_id", providerMessageId)
    .order("attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (attemptResult.error) return json({ error: attemptResult.error.message }, 500);
  if (!attemptResult.data) return json({ ignored: true, reason: "attempt_not_found" });

  const nextStatus = statusFromEvent(type);
  const current = clean((attemptResult.data as any).status, 40);
  const rank: Record<string, number> = { prepared: 0, sending: 1, sent: 2, delivered: 3, read: 4 };
  const patch: Record<string, unknown> = { provider_payload: event };
  const now = clean(event?.created_at, 80) || new Date().toISOString();
  let updateAttempt = false;

  if (nextStatus === "failed") {
    if (!["delivered", "read"].includes(current)) {
      patch.status = "failed";
      patch.error_message = clean(
        event?.data?.bounce?.message || event?.data?.reason || event?.data?.error || `Falha Resend: ${type}`,
        1200,
      );
      updateAttempt = true;
    }
  } else if (nextStatus && (rank[nextStatus] ?? -1) > (rank[current] ?? -1)) {
    patch.status = nextStatus;
    if (nextStatus === "sent") patch.sent_at = now;
    if (nextStatus === "delivered") patch.delivered_at = now;
    updateAttempt = true;
  }

  if (updateAttempt) {
    const updated = await admin.from("buyer_outreach_delivery_attempts").update(patch).eq("id", (attemptResult.data as any).id);
    if (updated.error) return json({ error: updated.error.message }, 500);
  }

  if (nextStatus === "failed" && !["delivered", "read"].includes(current)) {
    const opportunity = await admin.from("buyer_property_opportunities").update({
      status: "failed",
      last_error: patch.error_message || `Falha Resend: ${type}`,
      updated_at: new Date().toISOString(),
    }).eq("id", (attemptResult.data as any).opportunity_id);
    if (opportunity.error) return json({ error: opportunity.error.message }, 500);
  }

  return json({ ok: true, type, updated: updateAttempt });
});
