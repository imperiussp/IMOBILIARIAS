import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const verifyToken = Deno.env.get("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN") || "";
const appSecret = Deno.env.get("META_APP_SECRET") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function classifyResponse(text: string) {
  const value = normalizeText(text);
  if (!value) return "reply";
  const optOut = ["nao quero receber", "não quero receber", "nao me envie mais", "não me envie mais", "pare de enviar", "pare de mandar", "parar de receber", "cancelar mensagens", "remover meu numero", "remover meu número", "sair da lista", "descadastrar", "unsubscribe"];
  if (optOut.some((term) => value.includes(normalizeText(term)))) return "opt_out";
  const visit = ["quero visitar", "agendar visita", "marcar visita", "visitar o imovel", "visitar o imóvel"];
  if (visit.some((term) => value.includes(normalizeText(term)))) return "request_visit";
  const details = ["mais detalhes", "mais informacoes", "mais informações", "quero saber mais", "me passa os detalhes"];
  if (details.some((term) => value.includes(normalizeText(term)))) return "request_details";
  const negative = ["nao tenho interesse", "não tenho interesse", "nao interessa", "não interessa", "sem interesse"];
  if (negative.some((term) => value.includes(normalizeText(term)))) return "not_interested";
  const positive = ["tenho interesse", "estou interessado", "estou interessada", "me interessei", "gostei do imovel", "gostei do imóvel"];
  if (positive.some((term) => value.includes(normalizeText(term)))) return "interested";
  return "reply";
}

function extractMessageText(message: any) {
  if (!message) return "";
  if (message.type === "text") return clean(message.text?.body, 4000);
  if (message.type === "button") return clean(message.button?.text || message.button?.payload, 4000);
  if (message.type === "interactive") return clean(message.interactive?.button_reply?.title || message.interactive?.button_reply?.id || message.interactive?.list_reply?.title || message.interactive?.list_reply?.id, 4000);
  return clean(message.caption, 4000);
}

async function verifySignature(rawBody: string, supplied: string) {
  if (!appSecret) return false;
  const expectedPrefix = "sha256=";
  if (!supplied.startsWith(expectedPrefix)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const digest = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const received = supplied.slice(expectedPrefix.length).toLowerCase();
  if (received.length !== digest.length) return false;
  let diff = 0;
  for (let i = 0; i < digest.length; i++) diff |= digest.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}

async function preserveEarlyEvent(admin:any, providerEventId:string, providerMessageId:string, eventType:string, payload:any){
  const saved=await admin.from("outreach_provider_event_inbox").upsert({provider:"meta_whatsapp",provider_event_id:providerEventId,provider_message_id:providerMessageId,event_type:eventType,payload},{onConflict:"provider,provider_event_id",ignoreDuplicates:true});
  return !saved.error;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode") || "";
    const token = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && verifyToken && token === verifyToken) return new Response(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    return json({ error: "verification_failed" }, 403);
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json({ error: "supabase_not_configured" }, 500);

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (!await verifySignature(rawBody, signature)) return json({ error: "invalid_signature" }, 401);
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return json({ error: "invalid_json" }, 400); }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let processedStatuses = 0, processedMessages = 0, ignored = 0, ambiguous = 0, deferred = 0;

  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field !== "messages") continue;
      const value = change?.value || {};

      for (const status of value?.statuses || []) {
        const providerMessageId = clean(status?.id, 240);
        const statusName = clean(status?.status, 40).toLowerCase();
        if (!providerMessageId || !["sent", "delivered", "read", "failed"].includes(statusName)) { ignored++; continue; }
        const attempt = await admin.from("buyer_outreach_delivery_attempts").select("id,opportunity_id,status").eq("provider_message_id", providerMessageId).order("attempted_at", { ascending: false }).limit(1).maybeSingle();
        if (attempt.error) return json({ error: attempt.error.message }, 500);
        if (!attempt.data) {
          const timestamp=clean(status?.timestamp,80)||String(Date.now());
          const eventId=`${providerMessageId}:${statusName}:${timestamp}`;
          if(await preserveEarlyEvent(admin,eventId,providerMessageId,statusName,status))deferred++;else ignored++;
          continue;
        }

        const now = new Date().toISOString();
        const current = clean((attempt.data as any).status, 40);
        const rank: Record<string, number> = { prepared: 0, sending: 1, sent: 2, delivered: 3, read: 4 };
        const patch: Record<string, unknown> = { provider_payload: status };
        let shouldUpdate = false;
        if (statusName === "failed") {
          if (!["delivered", "read"].includes(current)) { patch.status = "failed"; patch.error_message = clean(status?.errors?.[0]?.title || status?.errors?.[0]?.message || "Falha informada pela Meta.", 1200); shouldUpdate = true; }
        } else if ((rank[statusName] ?? -1) > (rank[current] ?? -1)) {
          patch.status = statusName;
          if (statusName === "sent") patch.sent_at = now;
          if (statusName === "delivered") patch.delivered_at = now;
          if (statusName === "read") { patch.read_at = now; patch.delivered_at = now; }
          shouldUpdate = true;
        }
        if (shouldUpdate) { const update = await admin.from("buyer_outreach_delivery_attempts").update(patch).eq("id", (attempt.data as any).id); if (update.error) return json({ error: update.error.message }, 500); }
        if (statusName === "failed" && !["delivered", "read"].includes(current)) { const opportunityUpdate = await admin.from("buyer_property_opportunities").update({ status: "failed", last_error: patch.error_message, updated_at: now }).eq("id", (attempt.data as any).opportunity_id); if (opportunityUpdate.error) return json({ error: opportunityUpdate.error.message }, 500); }
        processedStatuses++;
      }

      for (const message of value?.messages || []) {
        const providerMessageId = clean(message?.id, 240);
        const contextMessageId = clean(message?.context?.id, 240);
        const responseText = extractMessageText(message);
        if (!providerMessageId) { ignored++; continue; }
        const relatedMessageId = contextMessageId || "";
        let attempt: any = null;
        if (relatedMessageId) {
          const attemptResult = await admin.from("buyer_outreach_delivery_attempts").select("id,agency_id,opportunity_id,lead_id,property_id,channel,provider_message_id").eq("provider_message_id", relatedMessageId).order("attempted_at", { ascending: false }).limit(1).maybeSingle();
          if (attemptResult.error) return json({ error: attemptResult.error.message }, 500);
          attempt = attemptResult.data;
          if(!attempt){
            if(await preserveEarlyEvent(admin,providerMessageId,relatedMessageId,"meta_message",message))deferred++;else ignored++;
            continue;
          }
        }

        if (!attempt) {
          const from = clean(message?.from, 80).replace(/\D/g, "");
          if (from) {
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const candidates = await admin.from("buyer_outreach_delivery_attempts").select("id,agency_id,opportunity_id,lead_id,property_id,channel,provider_message_id,attempted_at,leads!inner(phone)").eq("channel", "whatsapp").in("status", ["sent", "delivered", "read"]).gte("attempted_at", since).order("attempted_at", { ascending: false }).limit(200);
            if (candidates.error) return json({ error: candidates.error.message }, 500);
            const matches = (candidates.data || []).filter((row: any) => clean(row?.leads?.phone, 80).replace(/\D/g, "") === from);
            const identities = new Set(matches.map((row: any) => `${row.agency_id}:${row.lead_id}`));
            if (identities.size === 1) attempt = matches[0] || null; else if (identities.size > 1) ambiguous++;
          }
        }
        if (!attempt) { ignored++; continue; }

        const receivedAt = message?.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString();
        const responseKind = classifyResponse(responseText);
        const insert = await admin.from("buyer_outreach_responses").upsert({ agency_id: attempt.agency_id, opportunity_id: attempt.opportunity_id, lead_id: attempt.lead_id, property_id: attempt.property_id, channel: "whatsapp", provider: "meta_whatsapp", provider_event_id: providerMessageId, provider_message_id: providerMessageId, response_text: responseText || null, response_kind: responseKind, received_at: receivedAt, provider_payload: message }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
        if (insert.error) return json({ error: insert.error.message }, 500);
        if (responseKind === "opt_out") { const permissionUpdate = await admin.from("lead_contact_permissions").update({ automated_property_alerts_allowed: false, whatsapp_allowed: false, revoked_at: receivedAt, updated_at: receivedAt }).eq("agency_id", attempt.agency_id).eq("lead_id", attempt.lead_id); if (permissionUpdate.error) return json({ error: permissionUpdate.error.message }, 500); }
        processedMessages++;
      }
    }
  }

  return json({ ok: true, processed_statuses: processedStatuses, processed_messages: processedMessages, deferred, ignored, ambiguous });
});
