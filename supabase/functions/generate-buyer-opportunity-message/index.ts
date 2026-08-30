import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const groqKey = Deno.env.get("GROQ_API_KEY") || "";
const groqModel = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-20b";
const geminiKey = Deno.env.get("GEMINI_API_KEY") || "";
const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash-lite";

const legacyAiUrl = Deno.env.get("AI_API_URL") || "";
const legacyAiKey = Deno.env.get("AI_API_KEY") || "";
const legacyAiModel = Deno.env.get("AI_MODEL") || "";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

type Message = { role: "system" | "user"; content: string };
type Provider = { name: string; url: string; key: string; model: string };
type Generated = { content: string; provider: string; model: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

function configuredProviders(): Provider[] {
  const providers: Provider[] = [];
  if (groqKey) providers.push({
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: groqKey,
    model: groqModel,
  });
  if (geminiKey) providers.push({
    name: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    key: geminiKey,
    model: geminiModel,
  });
  if (legacyAiUrl && legacyAiKey && legacyAiModel) providers.push({
    name: "legacy",
    url: legacyAiUrl,
    key: legacyAiKey,
    model: legacyAiModel,
  });
  return providers;
}

async function generateWithFallback(messages: Message[], temperature: number, maxTokens: number): Promise<Generated> {
  const providers = configuredProviders();
  if (!providers.length) throw new Error("ai_providers_not_configured");

  const errors: string[] = [];
  for (const provider of providers) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = String(body?.error?.message || body?.message || `HTTP ${response.status}`).slice(0, 180);
        errors.push(`${provider.name}:${detail}`);
        continue;
      }
      const content = String(body?.choices?.[0]?.message?.content || "").trim();
      if (!content) {
        errors.push(`${provider.name}:empty_response`);
        continue;
      }
      return { content, provider: provider.name, model: provider.model };
    } catch (error) {
      const detail = error instanceof DOMException && error.name === "AbortError"
        ? "timeout"
        : error instanceof Error ? error.message : String(error);
      errors.push(`${provider.name}:${detail.slice(0, 180)}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`ai_providers_unavailable:${errors.join("|").slice(0, 500)}`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "supabase_not_configured" }, 500);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const user = await client.auth.getUser();
  if (user.error || !user.data.user) return json({ error: "unauthorized" }, 401);

  const release = await admin
    .from("platform_release_controls")
    .select("environment_mode,maintenance_mode,ai_generation_enabled")
    .eq("id", 1)
    .maybeSingle();
  if (release.error) return json({ error: "release_controls_unavailable" }, 503);
  if (release.data?.maintenance_mode) return json({ error: "platform_maintenance_mode" }, 423);
  if (release.data?.ai_generation_enabled !== true) {
    return json({ error: "ai_generation_disabled", environment_mode: release.data?.environment_mode || "unknown" }, 423);
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const opportunityId = String(body.opportunity_id || "").trim();
  if (!opportunityId) return json({ error: "opportunity_required" }, 400);

  const opportunity = await client
    .from("buyer_property_opportunities")
    .select("id,agency_id,lead_id,property_id,match_score,status,channel,leads(name,phone,email),properties(code,title,description,price,purpose,zone,segment,bedrooms,suites,bathrooms,parking_spaces,built_area_m2,land_area_m2)")
    .eq("id", opportunityId)
    .maybeSingle();
  if (opportunity.error || !opportunity.data) {
    return json({ error: opportunity.error?.message || "opportunity_not_found" }, 404);
  }

  const agencyId = String(opportunity.data.agency_id);

  const testAccount = await admin
    .from("test_client_accounts")
    .select("agency_id")
    .eq("agency_id", agencyId)
    .eq("enabled", true)
    .maybeSingle();
  if (testAccount.data) return json({ error: "test_environment_ai_disabled" }, 403);

  const [membership, platformAdmin] = await Promise.all([
    client.from("agency_memberships").select("role").eq("agency_id", agencyId).eq("user_id", user.data.user.id).eq("active", true).maybeSingle(),
    client.rpc("is_platform_admin"),
  ]);
  if (membership.error) return json({ error: membership.error.message }, 500);
  if (platformAdmin.error) return json({ error: platformAdmin.error.message }, 500);

  const manager = membership.data && ["owner", "admin"].includes(String(membership.data.role));
  if (!manager && platformAdmin.data !== true) return json({ error: "manager_access_required" }, 403);

  const entitlement = await client.rpc("agency_has_plan_feature", {
    p_agency_id: agencyId,
    p_feature_key: "ai_buyer_outreach",
    p_default: false,
  });
  if (entitlement.error || entitlement.data !== true) return json({ error: "plan_feature_unavailable" }, 403);

  const [permission, settings] = await Promise.all([
    client.from("lead_contact_permissions")
      .select("whatsapp_allowed,email_allowed,sms_allowed,automated_property_alerts_allowed,revoked_at")
      .eq("agency_id", agencyId)
      .eq("lead_id", opportunity.data.lead_id)
      .maybeSingle(),
    client.from("buyer_outreach_settings")
      .select("enabled,channels")
      .eq("agency_id", agencyId)
      .maybeSingle(),
  ]);
  if (permission.error) return json({ error: permission.error.message }, 500);
  if (settings.error || !settings.data?.enabled) {
    return json({ error: settings.error?.message || "buyer_outreach_disabled" }, 409);
  }

  if (!permission.data?.automated_property_alerts_allowed || permission.data?.revoked_at) {
    return json({ error: "buyer_consent_required" }, 409);
  }

  const channel = String(opportunity.data.channel || "").toLowerCase();
  if (channel === "whatsapp" && !permission.data.whatsapp_allowed) return json({ error: "whatsapp_not_allowed" }, 409);
  if (channel === "email" && !permission.data.email_allowed) return json({ error: "email_not_allowed" }, 409);
  if (channel === "sms" && !permission.data.sms_allowed) return json({ error: "sms_not_allowed" }, 409);
  if (channel && Array.isArray(settings.data.channels) && !settings.data.channels.includes(channel)) {
    return json({ error: "channel_disabled" }, 409);
  }

  const lead = (opportunity.data.leads || {}) as Record<string, unknown>;
  const property = (opportunity.data.properties || {}) as Record<string, unknown>;

  const facts = [
    `Nome do comprador: ${String(lead.name || "cliente")}`,
    `Compatibilidade: ${opportunity.data.match_score}%`,
    property.code ? `Código do imóvel: ${property.code}` : "",
    property.title ? `Imóvel: ${property.title}` : "",
    property.price != null ? `Preço: R$ ${Number(property.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "",
    property.purpose ? `Finalidade: ${property.purpose}` : "",
    property.zone ? `Zona: ${property.zone}` : "",
    property.segment ? `Segmento: ${property.segment}` : "",
    property.bedrooms != null ? `Quartos: ${property.bedrooms}` : "",
    property.suites != null ? `Suítes: ${property.suites}` : "",
    property.bathrooms != null ? `Banheiros: ${property.bathrooms}` : "",
    property.parking_spaces != null ? `Vagas: ${property.parking_spaces}` : "",
    property.built_area_m2 != null ? `Área construída: ${property.built_area_m2} m²` : "",
    property.land_area_m2 != null ? `Área do terreno: ${property.land_area_m2} m²` : "",
    property.description ? `Descrição cadastrada: ${String(property.description).slice(0, 1200)}` : "",
  ].filter(Boolean).join("\n");

  const system = "Você escreve mensagens comerciais imobiliárias em português brasileiro. Seja cordial, breve e natural. Nunca invente características, localização, condições de pagamento, metragem ou benefícios. Use somente os dados fornecidos. Não pressione o cliente. Não diga que é inteligência artificial. Termine com convite simples para responder se quiser mais informações.";
  const prompt = `Crie uma mensagem curta para avisar um comprador de que surgiu um imóvel compatível com as preferências registradas. Canal: ${channel || "WhatsApp"}.\n\nDados confirmados:\n${facts}`;

  let generated: Generated;
  try {
    generated = await generateWithFallback([
      { role: "system", content: system },
      { role: "user", content: prompt },
    ], 0.35, 350);
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    if (code === "ai_providers_not_configured") return json({ error: "AI provider ainda não configurado no servidor." }, 503);
    return json({ error: "Os provedores de IA estão temporariamente indisponíveis." }, 502);
  }

  const message = generated.content.slice(0, 3000);
  const nextStatus = opportunity.data.status === "approved" ? "approved" : "review";
  const update = await client
    .from("buyer_property_opportunities")
    .update({
      ai_message: message,
      ai_provider: `${generated.provider}:${generated.model}`,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opportunityId)
    .eq("agency_id", agencyId);

  if (update.error) return json({ error: update.error.message }, 500);

  return json({
    message,
    status: nextStatus,
    provider: generated.provider,
    model: generated.model,
  });
});
