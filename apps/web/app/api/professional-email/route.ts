import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type CpanelPayload = {
  result?: { status?: number; errors?: string[] | string | null; messages?: string[] | string | null };
};

function serverSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function cpanelBaseUrl() {
  const raw = String(process.env.CPANEL_HOST || "").trim().replace(/\/$/, "");
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
  const user = String(process.env.CPANEL_USER || "").trim();
  const token = String(process.env.CPANEL_API_TOKEN || "").trim();
  if (!base || !user || !token) throw new Error("O servidor de e-mails ainda não foi conectado à plataforma.");
  const query = new URLSearchParams(params);
  const response = await fetch(`${base}/execute/${module}/${fn}?${query.toString()}`, {
    method: "GET",
    headers: { Authorization: `cpanel ${user}:${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as CpanelPayload | null;
  if (!response.ok || payload?.result?.status !== 1) {
    const errors = payload?.result?.errors;
    const message = Array.isArray(errors) ? errors.join(" · ") : String(errors || "Falha ao executar a operação no servidor de e-mail.");
    throw new Error(message);
  }
  return payload;
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return NextResponse.json({ error: "Sessão não informada." }, { status: 401 });
  const supabase = serverSupabase(accessToken);
  if (!supabase) return NextResponse.json({ error: "Supabase não configurado no servidor." }, { status: 503 });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const agencyId = String(body.agency_id || "").trim();
  const localPart = String(body.local_part || "").trim().toLowerCase();
  const domain = String(body.domain || "").trim().toLowerCase();
  const password = String(body.password || "");
  const quotaMb = Math.min(Math.max(Number(body.quota_mb || 1024), 100), 10240);

  if (!agencyId || !/^[a-z0-9][a-z0-9._-]{0,62}$/.test(localPart)) return NextResponse.json({ error: "Escolha um nome de e-mail válido." }, { status: 400 });
  if (!/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(domain)) return NextResponse.json({ error: "Domínio de e-mail inválido." }, { status: 400 });
  if (password.length < 10) return NextResponse.json({ error: "Use uma senha de e-mail com pelo menos 10 caracteres." }, { status: 400 });

  const usage = await supabase.rpc("agency_email_usage_snapshot", { p_agency_id: agencyId });
  if (usage.error) return NextResponse.json({ error: usage.error.message }, { status: 403 });
  const usageRow = Array.isArray(usage.data) ? usage.data[0] : null;
  if (!usageRow?.can_create) return NextResponse.json({ error: "O plano não possui vaga disponível para uma nova conta de e-mail." }, { status: 409 });

  if (domain !== "imoveis.lenoy.com.br") {
    const verifiedDomain = await supabase.from("agency_domains").select("hostname,verified").eq("agency_id", agencyId).eq("verified", true).eq("hostname", domain).maybeSingle();
    if (verifiedDomain.error || !verifiedDomain.data) return NextResponse.json({ error: "Esse domínio próprio ainda não está verificado para a imobiliária." }, { status: 400 });
  }

  const existing = await supabase.from("agency_mailboxes").select("id").eq("agency_id", agencyId).eq("email_address", `${localPart}@${domain}`).is("deleted_at", null).maybeSingle();
  if (existing.data) return NextResponse.json({ error: "Esse endereço já está cadastrado." }, { status: 409 });

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
      return NextResponse.json({ error: registered.error.message }, { status: 409 });
    }

    return NextResponse.json({ ok: true, email: `${localPart}@${domain}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar a conta de e-mail." }, { status: 502 });
  }
}
