import { createClient } from "jsr:@supabase/supabase-js@2.112.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const siteUrl = (Deno.env.get("PLATFORM_SITE_URL") || "https://imoveis.lenoy.com.br").replace(/\/$/, "");
const wordpressEndpoint = (Deno.env.get("WORDPRESS_AUTH_MAIL_URL") || "https://lenoy.com.br/wp-json/lenoy/v1/auth-mail").trim();

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
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

async function findUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 5; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) return null;
    const found = result.data.users.find((user: any) => String(user.email || "").toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (result.data.users.length < 200) break;
  }
  return null;
}

function buildMessage(name: string, actionLink: string, kind: string) {
  const safeName = escapeHtml(name || "cliente");
  const safeLink = escapeHtml(actionLink);
  const isRecovery = kind === "password_recovery";
  const subject = isRecovery
    ? "Crie ou altere sua senha | LENOY IMOBILIÁRIAS"
    : "Seu acesso à LENOY IMOBILIÁRIAS";

  const heading = isRecovery ? "Crie uma nova senha" : "Seu acesso está pronto";
  const intro = isRecovery
    ? "Recebemos uma solicitação para criar ou alterar a senha da sua conta."
    : "Seu acesso à plataforma LENOY IMOBILIÁRIAS foi criado. Para entrar pela primeira vez, defina sua senha.";

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#183149">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e8ed">
          <tr><td style="background:#0b2946;padding:24px 28px;color:#ffffff">
            <div style="font-size:22px;font-weight:700">LENOY IMOBILIÁRIAS</div>
            <div style="font-size:13px;color:#c9d6e2;margin-top:4px">Plataforma para imobiliárias</div>
          </td></tr>
          <tr><td style="padding:30px 28px">
            <p style="margin:0 0 10px;font-size:15px">Olá, <strong>${safeName}</strong>.</p>
            <h1 style="margin:0 0 14px;font-size:25px;line-height:1.2;color:#10263d">${heading}</h1>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#4c6073">${intro}</p>
            <p style="margin:0 0 26px">
              <a href="${safeLink}" style="display:inline-block;background:#0b2946;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">Criar / alterar senha</a>
            </p>
            <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:#7d8a96">Se o botão não abrir, copie e cole este endereço no navegador:</p>
            <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;color:#315a7c">${safeLink}</p>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#7d8a96">Se você não solicitou esta alteração, ignore esta mensagem.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    "LENOY IMOBILIÁRIAS",
    "",
    `Olá, ${name || "cliente"}.`,
    heading,
    intro,
    "",
    `Criar / alterar senha: ${actionLink}`,
    "",
    "Se você não solicitou esta alteração, ignore esta mensagem.",
  ].join("\n");

  return { subject, html, text };
}

async function queueAndSendWordPress(
  admin: any,
  email: string,
  name: string,
  kind: "admin_access" | "password_recovery" | "paid_onboarding",
  redirectTo: string,
) {
  const generated = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  } as any);

  if (generated.error) {
    return { ok: false, error: "link_generation_failed", detail: generated.error.message };
  }

  const actionLink = clean((generated.data as any)?.properties?.action_link, 8000);
  if (!actionLink) return { ok: false, error: "link_generation_failed", detail: "action_link_missing" };

  const token = randomToken(36);
  const tokenHash = await sha256(token);
  const message = buildMessage(name, actionLink, kind);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const inserted = await admin.from("auth_mail_bridge_requests").insert({
    token_hash: tokenHash,
    email,
    subject: message.subject,
    html_body: message.html,
    text_body: message.text,
    kind,
    expires_at: expiresAt,
  }).select("id").single();

  if (inserted.error || !inserted.data) {
    return { ok: false, error: "mail_queue_failed", detail: inserted.error?.message || "insert_failed" };
  }

  let response: Response;
  try {
    response = await fetch(wordpressEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "wordpress_unreachable";
    await admin.from("auth_mail_bridge_requests").update({ last_error: detail }).eq("id", inserted.data.id);
    return { ok: false, error: "wordpress_unreachable", detail };
  }

  const responseBody = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || responseBody.ok !== true) {
    const detail = clean(responseBody.error || responseBody.message || `WordPress HTTP ${response.status}`, 1200);
    await admin.from("auth_mail_bridge_requests").update({ last_error: detail }).eq("id", inserted.data.id);
    return { ok: false, error: "wordpress_mail_failed", detail };
  }

  return { ok: true, provider: "wordpress", wordpress_status: response.status };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = clean(body.action, 40).toLowerCase();

  if (action === "health") {
    return json({ ok: true, provider: "wordpress", endpoint: wordpressEndpoint });
  }

  if (action === "consume") {
    const token = clean(body.token, 300);
    if (!/^[A-Za-z0-9_-]{40,120}$/.test(token)) return json({ error: "invalid_token" }, 400);

    const tokenHash = await sha256(token);
    const now = new Date().toISOString();
    const requestRow = await admin.from("auth_mail_bridge_requests")
      .select("id,email,subject,html_body,text_body,expires_at,consumed_at")
      .eq("token_hash", tokenHash)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .maybeSingle();

    if (requestRow.error) return json({ error: requestRow.error.message }, 500);
    if (!requestRow.data) return json({ error: "token_not_found_or_expired" }, 404);

    const consumed = await admin.from("auth_mail_bridge_requests")
      .update({ consumed_at: now })
      .eq("id", requestRow.data.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();

    if (consumed.error || !consumed.data) return json({ error: "token_already_consumed" }, 409);

    return json({
      ok: true,
      to: requestRow.data.email,
      subject: requestRow.data.subject,
      html: requestRow.data.html_body,
      text: requestRow.data.text_body,
    });
  }

  if (action === "send_access") {
    const authHeader = request.headers.get("authorization") || "";
    const supplied = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!supplied || supplied !== serviceRoleKey) return json({ error: "internal_authorization_required" }, 401);

    const email = clean(body.email, 320).toLowerCase();
    const name = clean(body.name, 240);
    const kindRaw = clean(body.kind, 40);
    const kind = kindRaw === "paid_onboarding" ? "paid_onboarding" : "admin_access";
    const redirectTo = clean(body.redirect_to, 1200) || `${siteUrl}/nova-senha/`;
    if (!email || !email.includes("@")) return json({ error: "valid_email_required" }, 400);

    const user = await findUserByEmail(admin, email);
    if (!user) return json({ error: "auth_user_not_found" }, 404);

    const sent = await queueAndSendWordPress(admin, email, name || clean(user.user_metadata?.full_name, 240), kind, redirectTo);
    return sent.ok ? json(sent) : json(sent, 502);
  }

  if (action === "request_recovery") {
    const email = clean(body.email, 320).toLowerCase();
    if (!email || !email.includes("@")) return json({ error: "valid_email_required" }, 400);

    const cutoffMinute = new Date(Date.now() - 60 * 1000).toISOString();
    const cutoffHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const recentMinute = await admin.from("auth_mail_bridge_requests")
      .select("id", { count: "exact", head: true })
      .eq("kind", "password_recovery")
      .ilike("email", email)
      .gte("created_at", cutoffMinute);

    const recentHour = await admin.from("auth_mail_bridge_requests")
      .select("id", { count: "exact", head: true })
      .eq("kind", "password_recovery")
      .ilike("email", email)
      .gte("created_at", cutoffHour);

    if ((recentMinute.count || 0) >= 1 || (recentHour.count || 0) >= 5) {
      return json({ ok: true, accepted: true, rate_limited: true });
    }

    const user = await findUserByEmail(admin, email);
    if (!user) return json({ ok: true, accepted: true });

    const sent = await queueAndSendWordPress(
      admin,
      email,
      clean(user.user_metadata?.full_name, 240),
      "password_recovery",
      `${siteUrl}/nova-senha/`,
    );

    if (!sent.ok) console.error("auth_mail_bridge_recovery_failed", sent);
    return json({ ok: true, accepted: true, provider: sent.ok ? "wordpress" : "unavailable" });
  }

  return json({ error: "unsupported_action" }, 400);
});
