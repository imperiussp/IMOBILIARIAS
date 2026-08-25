import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CpanelPayload = {
  result?: {
    status?: number;
    errors?: string[] | string | null;
    messages?: string[] | string | null;
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function cleanExcerpt(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

async function cpanelCall(module: string, fn: string, params: Record<string, string>) {
  const base = cpanelBaseUrl();
  const user = String(Deno.env.get("CPANEL_USER") || "").trim().toLowerCase();
  const token = String(Deno.env.get("CPANEL_API_TOKEN") || "").trim();
  if (!base || !user || !token) {
    throw new Error("O servidor de e-mails ainda não foi conectado à plataforma.");
  }

  const query = new URLSearchParams(params);
  const suffix = query.size ? `?${query.toString()}` : "";
  const url = `${base}/execute/${module}/${fn}${suffix}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `cpanel ${user}:${token}`,
        Accept: "application/json",
      },
    });
  } catch (error) {
    console.error("CPANEL_NETWORK_ERROR", {
      base,
      module,
      fn,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Não foi possível alcançar o servidor cPanel na porta 2083. Verifique o host ou se a hospedagem bloqueia conexões externas à API.");
  }

  const raw = await response.text();
  let payload: CpanelPayload | null = null;
  try {
    payload = raw ? JSON.parse(raw) as CpanelPayload : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const excerpt = cleanExcerpt(raw);
    console.error("CPANEL_HTTP_ERROR", {
      base,
      module,
      fn,
      status: response.status,
      contentType: response.headers.get("content-type"),
      server: response.headers.get("server"),
      excerpt,
    });

    if (response.status === 401 || response.status === 403) {
      const detail = excerpt ? ` Resposta do servidor: ${excerpt}` : "";
      throw new Error(`O cPanel recusou a autenticação (HTTP ${response.status}).${detail}`);
    }

    throw new Error(`O cPanel respondeu com HTTP ${response.status}. ${excerpt || "Sem detalhes adicionais."}`);
  }

  if (!payload) {
    console.error("CPANEL_NON_JSON_RESPONSE", {
      base,
      module,
      fn,
      status: response.status,
      contentType: response.headers.get("content-type"),
      excerpt: cleanExcerpt(raw),
    });
    throw new Error(`O cPanel respondeu, mas não retornou JSON da API. ${cleanExcerpt(raw) || "Verifique o endereço configurado em CPANEL_HOST."}`);
  }

  if (payload.result?.status !== 1) {
    const errors = payload.result?.errors;
    const messages = payload.result?.messages;
    const errorText = Array.isArray(errors) ? errors.join(" · ") : String(errors || "");
    const messageText = Array.isArray(messages) ? messages.join(" · ") : String(messages || "");
    const detail = errorText || messageText || "A operação foi recusada sem detalhes adicionais.";
    console.error("CPANEL_UAPI_ERROR", { base, module, fn, detail });
    throw new Error(`A API do cPanel recusou a operação: ${detail}`);
  }

  return payload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Sessão não informada." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) return json({ error: "Supabase não configurado na função." }, 503);

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const agencyId = String(body.agency_id || "").trim();
  const action = String(body.action || "create").trim().toLowerCase();
  if (!agencyId) return json({ error: "Imobiliária não informada." }, 400);

  const usage = await supabase.rpc("agency_email_usage_snapshot", { p_agency_id: agencyId });
  if (usage.error) return json({ error: usage.error.message }, 403);
  const usageRow = Array.isArray(usage.data) ? usage.data[0] : null;
  if (!usageRow) return json({ error: "Não foi possível validar o acesso desta imobiliária." }, 403);

  if (action === "test") {
    try {
      await cpanelCall("Email", "list_pops", {});
      return json({ ok: true, message: "Conexão com o servidor de e-mail estabelecida." });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Não foi possível conectar ao servidor de e-mail." }, 502);
    }
  }

  const localPart = String(body.local_part || "").trim().toLowerCase();
  const domain = String(body.domain || "").trim().toLowerCase();
  const password = String(body.password || "");
  const quotaMb = Math.min(Math.max(Number(body.quota_mb || 1024), 100), 10240);

  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(localPart)) return json({ error: "Escolha um nome de e-mail válido." }, 400);
  if (!/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(domain)) return json({ error: "Domínio de e-mail inválido." }, 400);
  if (password.length < 10) return json({ error: "Use uma senha de e-mail com pelo menos 10 caracteres." }, 400);
  if (!usageRow.can_create) return json({ error: "O plano não possui vaga disponível para uma nova conta de e-mail." }, 409);

  if (domain !== "imoveis.lenoy.com.br") {
    const verifiedDomain = await supabase
      .from("agency_domains")
      .select("hostname,verified")
      .eq("agency_id", agencyId)
      .eq("verified", true)
      .eq("hostname", domain)
      .maybeSingle();
    if (verifiedDomain.error || !verifiedDomain.data) {
      return json({ error: "Esse domínio próprio ainda não está verificado para a imobiliária." }, 400);
    }
  }

  const existing = await supabase
    .from("agency_mailboxes")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("email_address", `${localPart}@${domain}`)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing.data) return json({ error: "Esse endereço já está cadastrado." }, 409);

  try {
    await cpanelCall("Email", "add_pop", {
      email: localPart,
      domain,
      password,
      quota: String(quotaMb),
    });

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
