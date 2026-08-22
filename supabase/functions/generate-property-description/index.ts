import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const aiUrl = Deno.env.get("AI_API_URL") || "";
const aiKey = Deno.env.get("AI_API_KEY") || "";
const aiModel = Deno.env.get("AI_MODEL") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function text(value: unknown, max = 600) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "supabase_not_configured" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const release = await admin.from("platform_release_controls").select("environment_mode,maintenance_mode,ai_generation_enabled").eq("id",1).maybeSingle();
  if (release.error) return json({ error: "release_controls_unavailable" }, 503);
  if (release.data?.maintenance_mode) return json({ error: "platform_maintenance_mode" }, 423);
  if (release.data?.ai_generation_enabled !== true) return json({ error: "ai_generation_disabled", environment_mode: release.data?.environment_mode || "unknown" }, 423);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const agencyId = text(payload.agency_id, 80);
  if (!agencyId) return json({ error: "agency_required" }, 400);

  const title = text(payload.title, 160);
  const type = text(payload.property_type, 80);
  const purpose = text(payload.purpose, 40);
  const city = text(payload.city, 100);
  const neighborhood = text(payload.neighborhood, 100);
  const price = text(payload.price, 60);
  const bedrooms = text(payload.bedrooms, 20);
  const bathrooms = text(payload.bathrooms, 20);
  const suites = text(payload.suites, 20);
  const parking = text(payload.parking, 20);
  const area = text(payload.area, 40);
  const notes = text(payload.notes, 1200);
  const tone = text(payload.tone, 40) || "profissional";

  if (!title && !type && !notes) return json({ error: "property_details_required" }, 400);

  const membership = await userClient
    .from("agency_memberships")
    .select("role")
    .eq("agency_id", agencyId)
    .eq("user_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();
  if (membership.error || !membership.data) return json({ error: "agency_access_denied" }, 403);

  const reservation = await userClient.rpc("reserve_ai_description_usage", {
    p_agency_id: agencyId,
    p_metadata: { source: "admin", tone, title: title || null },
  });
  if (reservation.error || !reservation.data) return json({ error: reservation.error?.message || "ai_quota_unavailable" }, 429);
  const usageEventId = String(reservation.data);

  if (!aiUrl || !aiKey || !aiModel) {
    await userClient.rpc("cancel_ai_description_usage", { p_event_id: usageEventId });
    return json({ error: "AI provider ainda não configurado no servidor." }, 503);
  }

  const facts = [
    title && `Título: ${title}`,
    type && `Tipo: ${type}`,
    purpose && `Finalidade: ${purpose}`,
    city && `Cidade: ${city}`,
    neighborhood && `Bairro: ${neighborhood}`,
    price && `Preço: ${price}`,
    bedrooms && `Quartos: ${bedrooms}`,
    suites && `Suítes: ${suites}`,
    bathrooms && `Banheiros: ${bathrooms}`,
    parking && `Vagas: ${parking}`,
    area && `Área: ${area}`,
    notes && `Observações: ${notes}`,
  ].filter(Boolean).join("\n");

  const system = "Você é redator de anúncios imobiliários no Brasil. Escreva em português brasileiro, com linguagem clara, persuasiva e responsável. Não invente características, localização, metragem, condições comerciais ou benefícios não fornecidos. Não use promessas absolutas. Produza somente a descrição final, sem título e sem comentários adicionais.";
  const prompt = `Crie uma descrição de imóvel em tom ${tone}. Use de 2 a 4 parágrafos curtos e, quando fizer sentido, finalize com uma chamada para contato.\n\nDados confirmados:\n${facts}`;

  try {
    const aiResponse = await fetch(aiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.55,
        max_tokens: 700,
      }),
    });
    const aiBody = await aiResponse.json().catch(() => null);
    if (!aiResponse.ok) throw new Error(aiBody?.error?.message || `AI HTTP ${aiResponse.status}`);
    const description = String(aiBody?.choices?.[0]?.message?.content || "").trim();
    if (!description) throw new Error("O provedor não retornou uma descrição.");
    return json({ description, usage_event_id: usageEventId });
  } catch (error) {
    await userClient.rpc("cancel_ai_description_usage", { p_event_id: usageEventId });
    return json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
});
