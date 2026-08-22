import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const adapterToken = Deno.env.get("BUYER_OUTREACH_WEBHOOK_TOKEN") || "";
const metaAccessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN") || "";
const metaPhoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID") || "";
const metaGraphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function bearer(request: Request) {
  const raw = request.headers.get("authorization") || "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] || char));
}

async function sendWhatsApp(destination: string, message: string, idempotencyKey: string) {
  if (!metaAccessToken || !metaPhoneNumberId || !metaGraphVersion) {
    return { error: "whatsapp_provider_not_configured", status: 503 };
  }

  const phone = normalizePhone(destination);
  if (!phone) return { error: "invalid_whatsapp_destination", status: 400 };

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(metaGraphVersion)}/${encodeURIComponent(metaPhoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${metaAccessToken}`,
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: { preview_url: false, body: message },
      }),
    },
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = clean((body as any)?.error?.message, 1200) || `Meta HTTP ${response.status}`;
    return { error: providerMessage, status: response.status >= 500 ? 502 : 400, provider: body };
  }

  return {
    message_id: clean((body as any)?.messages?.[0]?.id, 240) || null,
    provider: "meta_whatsapp",
    provider_payload: body,
  };
}

async function sendEmail(destination: string, message: string, idempotencyKey: string) {
  if (!resendApiKey || !resendFrom) {
    return { error: "email_provider_not_configured", status: 503 };
  }
  if (!destination.includes("@")) return { error: "invalid_email_destination", status: 400 };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${resendApiKey}`,
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [destination],
      subject: "Nova oportunidade de imóvel",
      text: message,
      html: `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = clean((body as any)?.message, 1200) || `Resend HTTP ${response.status}`;
    return { error: providerMessage, status: response.status >= 500 ? 502 : 400, provider: body };
  }

  return {
    message_id: clean((body as any)?.id, 240) || null,
    provider: "resend",
    provider_payload: body,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!adapterToken || bearer(request) !== adapterToken) return json({ error: "unauthorized" }, 401);
  if (!supabaseUrl || !serviceKey) return json({ error: "supabase_not_configured" }, 503);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const release = await admin.from("platform_release_controls").select("environment_mode,maintenance_mode,external_messaging_enabled").eq("id",1).maybeSingle();
  if (release.error) return json({ error: "release_controls_unavailable" }, 503);
  if (release.data?.maintenance_mode) return json({ error: "platform_maintenance_mode" }, 423);
  if (release.data?.external_messaging_enabled !== true) return json({ error: "external_messaging_disabled", environment_mode: release.data?.environment_mode || "unknown" }, 423);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const channel = clean(body.channel, 40).toLowerCase();
  const destination = clean(body.destination, 320);
  const message = clean(body.message, 4000);
  const attemptId = clean(body.attempt_id, 120);
  const idempotencyKey = clean(body.idempotency_key, 160) || attemptId;

  if (!destination || !message || !attemptId || !idempotencyKey) {
    return json({ error: "destination_message_attempt_required" }, 400);
  }

  let result: Record<string, unknown> & { error?: string; status?: number };
  if (channel === "whatsapp") result = await sendWhatsApp(destination, message, idempotencyKey);
  else if (channel === "email") result = await sendEmail(destination, message, idempotencyKey);
  else return json({ error: "unsupported_channel", channel }, 400);

  if (result.error) return json({ error: result.error, provider: result.provider || null }, result.status || 500);

  return json({
    ok: true,
    attempt_id: attemptId,
    channel,
    message_id: result.message_id || null,
    provider: result.provider || null,
    provider_payload: result.provider_payload || null,
  });
});
