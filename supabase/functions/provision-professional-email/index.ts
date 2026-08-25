import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstNamedKey(name: string) {
  const raw = Deno.env.get(name) || "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return String(parsed.default || Object.values(parsed)[0] || "");
  } catch {
    return raw;
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

async function secureEqual(left: string, right: string) {
  if (!left || !right) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = av.length ^ bv.length;
  for (let i = 0; i < Math.min(av.length, bv.length); i += 1) diff |= av[i] ^ bv[i];
  return diff === 0;
}

async function encryptPassword(password: string, workerToken: string) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(workerToken));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(password));
  return { cipher: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = firstNamedKey("SUPABASE_PUBLISHABLE_KEYS") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const adminKey = firstNamedKey("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const workerToken = String(Deno.env.get("CPANEL_API_TOKEN") || "").trim();
  if (!supabaseUrl || !publishableKey || !adminKey) return json({ error: "Supabase não configurado na função." }, 503);

  const admin = createClient(supabaseUrl, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || "create").trim().toLowerCase();

  if (action === "worker_pull" || action === "worker_complete") {
    const suppliedWorkerToken = String(req.headers.get("x-worker-token") || "").trim();
    if (!workerToken || !(await secureEqual(suppliedWorkerToken, workerToken))) return json({ error: "Worker não autorizado." }, 401);

    if (action === "worker_pull") {
      const localStatus = body.local_status === "ok" ? "ok" : "error";
      const localMessage = String(body.local_message || (localStatus === "ok" ? "Worker local ativo." : "UAPI local indisponível.")).slice(0, 900);
      await admin.from("mail_worker_state").upsert({
        worker_name: "cpanel-main",
        last_seen_at: new Date().toISOString(),
        last_status: localStatus,
        last_message: localMessage,
        updated_at: new Date().toISOString(),
      });

      if (localStatus !== "ok") return json({ ok: false, error: localMessage, job: null });

      const claimed = await admin.rpc("claim_agency_mailbox_job");
      if (claimed.error) return json({ error: claimed.error.message }, 500);
      const rows = Array.isArray(claimed.data) ? claimed.data : [];
      return json({ ok: true, job: rows[0] || null });
    }

    const jobId = String(body.job_id || "").trim();
    const success = body.success === true;
    const providerRef = String(body.provider_account_ref || "").trim();
    const errorMessage = String(body.error || "").trim();
    if (!jobId) return json({ error: "Solicitação não informada." }, 400);

    const completed = await admin.rpc("complete_agency_mailbox_job", {
      p_job_id: jobId,
      p_success: success,
      p_provider_account_ref: providerRef || null,
      p_error: errorMessage || null,
    });
    if (completed.error) return json({ error: completed.error.message }, 500);

    await admin.from("mail_worker_state").upsert({
      worker_name: "cpanel-main",
      last_seen_at: new Date().toISOString(),
      last_status: success ? "ok" : "error",
      last_message: success ? `Conta ${providerRef || jobId} processada.` : (errorMessage || "Falha no provisionamento."),
      updated_at: new Date().toISOString(),
    });
    return json({ ok: true });
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "Sessão não informada." }, 401);

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const agencyId = String(body.agency_id || "").trim();
  if (!agencyId) return json({ error: "Imobiliária não informada." }, 400);

  const usage = await supabase.rpc("agency_email_usage_snapshot", { p_agency_id: agencyId });
  if (usage.error) return json({ error: usage.error.message }, 403);
  const usageRow = Array.isArray(usage.data) ? usage.data[0] : null;
  if (!usageRow) return json({ error: "Não foi possível validar o acesso desta imobiliária." }, 403);

  if (action === "test") {
    const state = await admin.from("mail_worker_state").select("last_seen_at,last_status,last_message").eq("worker_name", "cpanel-main").maybeSingle();
    if (state.error) return json({ error: state.error.message }, 500);
    if (!state.data?.last_seen_at) return json({ ok: false, error: "O worker local do cPanel ainda não foi ativado. Configure o Cron Job para concluir a conexão." });
    const ageMs = Date.now() - new Date(state.data.last_seen_at).getTime();
    if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) return json({ ok: false, error: "O worker local do cPanel está sem sinal há mais de 5 minutos. Verifique o Cron Job." });
    if (state.data.last_status !== "ok") return json({ ok: false, error: state.data.last_message || "O worker está ativo, mas o UAPI local do cPanel apresentou erro." });
    return json({ ok: true, message: "Conexão local com o servidor de e-mail estabelecida." });
  }

  const localPart = String(body.local_part || "").trim().toLowerCase();
  const domain = String(body.domain || "").trim().toLowerCase();
  const password = String(body.password || "");
  const quotaMb = Math.min(Math.max(Number(body.quota_mb || 1024), 100), 10240);
  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(localPart)) return json({ error: "Escolha um nome de e-mail válido." }, 400);
  if (!/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(domain)) return json({ error: "Domínio de e-mail inválido." }, 400);
  if (password.length < 10) return json({ error: "Use uma senha de e-mail com pelo menos 10 caracteres." }, 400);
  if (!usageRow.can_create) return json({ error: "O plano não possui vaga disponível para uma nova conta de e-mail." }, 409);
  if (!workerToken) return json({ error: "Worker de e-mail ainda não configurado." }, 503);

  try {
    const protectedPassword = await encryptPassword(password, workerToken);
    const queued = await supabase.rpc("enqueue_agency_mailbox_job", {
      p_agency_id: agencyId,
      p_local_part: localPart,
      p_domain: domain,
      p_quota_mb: quotaMb,
      p_password_cipher: protectedPassword.cipher,
      p_password_iv: protectedPassword.iv,
    });
    if (queued.error) return json({ error: queued.error.message }, 409);
    const rows = Array.isArray(queued.data) ? queued.data : [];
    const row = rows[0] || {};
    return json({ ok: true, queued: true, job_id: row.job_id, email: row.email_address || `${localPart}@${domain}`, message: "Solicitação enviada ao servidor. A conta será processada pelo worker local." });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Não foi possível enfileirar a criação da conta de e-mail." }, 500);
  }
});
