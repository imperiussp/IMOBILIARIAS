import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const aiUrl = Deno.env.get("AI_API_URL") || "";
const aiKey = Deno.env.get("AI_API_KEY") || "";
const aiModel = Deno.env.get("AI_MODEL") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS" } });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  if (!supabaseUrl || !anonKey) return json({ error: "supabase_not_configured" }, 500);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const opportunityId = String(body.opportunity_id || "").trim();
  if (!opportunityId) return json({ error: "opportunity_required" }, 400);

  const opportunity = await client
    .from("buyer_property_opportunities")
    .select("id,agency_id,lead_id,property_id,match_score,status,channel,leads(name,phone,email),properties(code,title,description,price,purpose,zone,segment,bedrooms,suites,bathrooms,parking_spaces,built_area_m2,land_area_m2)")
    .eq("id", opportunityId)
    .maybeSingle();
  if (opportunity.error || !opportunity.data) return json({ error: opportunity.error?.message || "opportunity_not_found" }, 404);

  const agencyId = String(opportunity.data.agency_id);
  const membership = await client.from("agency_memberships").select("role").eq("agency_id", agencyId).eq("user_id", user.data.user.id).eq("active", true).maybeSingle();
  const platformAdmin = await client.rpc("is_platform_admin");
  const manager = membership.data && ["owner","admin"].includes(String(membership.data.role));
  if (!manager && platformAdmin.data !== true) return json({ error: "manager_access_required" }, 403);

  const entitlement = await client.rpc("agency_has_plan_feature", { p_agency_id: agencyId, p_feature_key: "ai_buyer_outreach", p_default: false });
  if (entitlement.error || entitlement.data !== true) return json({ error: "plan_feature_unavailable" }, 403);

  const permission = await client.from("lead_contact_permissions").select("whatsapp_allowed,email_allowed,sms_allowed,automated_property_alerts_allowed,revoked_at").eq("agency_id", agencyId).eq("lead_id", opportunity.data.lead_id).maybeSingle();
  const settings = await client.from("buyer_outreach_settings").select("enabled,require_explicit_consent").eq("agency_id", agencyId).maybeSingle();
  if (settings.error || !settings.data?.enabled) return json({ error: "buyer_outreach_disabled" }, 409);
  if (settings.data.require_explicit_consent && (!permission.data?.automated_property_alerts_allowed || permission.data?.revoked_at)) return json({ error: "buyer_consent_required" }, 409);

  if (!aiUrl || !aiKey || !aiModel) return json({ error: "AI provider ainda não configurado no servidor." }, 503);

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
  const prompt = `Crie uma mensagem curta para avisar um comprador de que surgiu um imóvel compatível com as preferências registradas. Canal: ${opportunity.data.channel || "WhatsApp"}.\n\nDados confirmados:\n${facts}`;

  const aiResponse = await fetch(aiUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${aiKey}` },
    body: JSON.stringify({ model: aiModel, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], temperature: 0.35, max_tokens: 350 }),
  });
  const aiBody = await aiResponse.json().catch(() => null);
  if (!aiResponse.ok) return json({ error: aiBody?.error?.message || `AI HTTP ${aiResponse.status}` }, 502);
  const message = String(aiBody?.choices?.[0]?.message?.content || "").trim();
  if (!message) return json({ error: "empty_ai_message" }, 502);

  const update = await client.from("buyer_property_opportunities").update({ ai_message: message, ai_provider: aiModel, status: "review", updated_at: new Date().toISOString() }).eq("id", opportunityId).eq("agency_id", agencyId);
  if (update.error) return json({ error: update.error.message }, 500);
  return json({ message });
});
