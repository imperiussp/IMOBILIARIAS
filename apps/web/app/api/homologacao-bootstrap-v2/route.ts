import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function redirectWith(request: NextRequest, kind: "success" | "error", message: string) {
  const url = new URL("/homologacao-bootstrap-v2", request.url);
  url.searchParams.set(kind, message.slice(0, 500));
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const publishableKey = String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "");
  if (!supabaseUrl || !publishableKey) {
    return redirectWith(request, "error", "Supabase do IMOBILIÁRIAS não está configurado no servidor.");
  }

  const form = await request.formData();
  const fullName = String(form.get("full_name") || "").trim();
  const agencyName = String(form.get("agency_name") || "").trim();
  const agencySlug = String(form.get("agency_slug") || "").trim().toLowerCase();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");
  const bootstrapToken = String(form.get("bootstrap_token") || "").trim();

  if (!fullName || !agencyName || !agencySlug || !email || !password || !bootstrapToken) {
    return redirectWith(request, "error", "Preencha todos os campos.");
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(agencySlug) || agencySlug.length < 3) {
    return redirectWith(request, "error", "O endereço da imobiliária é inválido. Use letras minúsculas, números e hífen.");
  }
  if (password.length < 8) return redirectWith(request, "error", "Use uma senha com pelo menos 8 caracteres.");
  if (password !== confirm) return redirectWith(request, "error", "As senhas não conferem.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          full_name: fullName,
          onboarding_kind: "agency_owner",
          agency_name: agencyName,
          agency_slug: agencySlug,
          bootstrap_token: bootstrapToken,
        },
        gotrue_meta_security: {},
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const message = String((payload as any)?.msg || (payload as any)?.message || (payload as any)?.error_description || `Falha no Auth (${response.status}).`);
      return redirectWith(request, "error", message);
    }

    return redirectWith(request, "success", `Conta criada. Confirme o e-mail e depois entre. Imobiliária: ${agencySlug}.imoveis.lenoy.com.br`);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "O Supabase Auth não respondeu em 20 segundos."
      : `Falha de comunicação com o Supabase Auth: ${error instanceof Error ? error.message : String(error)}`;
    return redirectWith(request, "error", message);
  } finally {
    clearTimeout(timeout);
  }
}
