import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CpanelPayload = {
  result?: { status?: number; errors?: string[] | string | null; messages?: string[] | string | null };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function cpanelBaseUrl() {
  const raw = String(Deno.env.get("CPANEL_HOST") || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!url.port) url.port = "2083";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function cpanelCall(module: string, fn: string, params: Record<string, string>) {
  const base = cpanelBaseUrl();
  const user = String(Deno.env.get("CPANEL_USER") || "").trim();
  const token = String(Deno.env.get("CPANEL_API_TOKEN") || "").trim();
  if (!base || !user || !token) throw new Error("O servidor de e-mails ainda não foi conectado à plataforma.");

  const query = new URLSearchParams(params);
  const response = await fetch(`${base}/execute/${module}/${fn}?${query.toString()}`, {
    method: "GET",
    headers: { Authorization: `cpanel ${user}:${token}`, Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null) as CpanelPayload | null;
  if (!response.ok || payload?.result?.status !== 1) {
    const errors = payload?.result?.errors;
    const message = Array.isArray(errors) ? errors.join(" · ") : String(errors || "Falha ao executar a operação no servidor de e-mail.");
    throw new Error(message);
  }
  return payload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "Sessão não informada." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) return json({ error: "Supabase não configurado na função." }, 503);

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const agencyId = String(body.agency_id || "").trim();
  const localPart = String(body.local_part || "").trim().toLowerCase();
  const domain = String(body.domain || "").trim().toLowerCase();
  const password = String(body.password || "");
  const quotaMb = Math.min(Math.max(Number(body.quota_mb || 1024), 100), 10240);

  if (!agencyId || !/^[a-z0-9][a-z0-9._-]{0,62}$/.test(localPart)) return json({ error: "Escolha um nome de e-mail válido." }, 400);
  if (!/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(domain)) return json({ error: "Domínio de e-mail inválido." }, 400);
  if (password.length < 10) return json({ error: "Use uma senha de e-mail com pelo menos 10 caracteres." }, 400);

  const usage = await supabase.rpc("agency_email_usage_snapshot", { p_agency_id: agencyId });
  if (usage.error) return json({ error: usage.error.message }, 403);
  const usageRow = Array.isArray(usage.data) ? usage.data[0] : null;
  if (!usageRow?.can_create) return json({ error: "O plano não possui vaga disponível para uma nova conta de e-mail." }, 409);

  if (domain !== "imoveis.lenoy.com.br") {
    const verifiedDomain = await supabase.from("agency_domains").select("hostname,verified").eq("agency_id", agencyId).eq("verified", true).eq("hostname", domain).maybeSingle();
    if (verifiedDomain.error || !verifiedDomain.data) return json({ error: "Esse domínio próprio ainda não está verificado para a imobiliária." }, 400);
  }

  const existing = await supabase.from("agency_mailboxes").select("id").eq("agency_id", agencyId).eq("email_address", `${localPart}@${domain}`).is("deleted_at", null).maybeSingle();
  if (existing.data) return json({ error: "Esse endereço já está cadastrado." }, 409);

  try {
    await cpanelCall("Email", "add_pop", { email: localPart, domain, password, quota: String(quotaMb) });

    const registered = await supabase.rpc("register_agency_mailbox", {
      p_agency_id: agencyId,
      p_local_part: localPart,
      p_domain: domain,
      p_provider_account_ref: `${localPart}@${domain}`,
      p_quota_mb: quotaMb,
    });

    if (registered.error) {
      await cpanelCall("Email", "delete_pop", { email: `${localPart}@${domain}` }).catch(() => null);
      return json({ error: registered.error.message }, 409);
    }

    return json({ ok: true, email: `${localPart}@${domain}` });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Não foi possível criar a conta de e-mail." }, 502);
  }
});
