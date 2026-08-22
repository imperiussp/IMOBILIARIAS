import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const maintenanceSecret = Deno.env.get("BUYER_OUTREACH_MAINTENANCE_SECRET") || "";
const aiUrl = Deno.env.get("AI_API_URL") || "";
const aiKey = Deno.env.get("AI_API_KEY") || "";
const aiModel = Deno.env.get("AI_MODEL") || "";
const deliveryUrl = Deno.env.get("BUYER_OUTREACH_WEBHOOK_URL") || "";
const deliveryToken = Deno.env.get("BUYER_OUTREACH_WEBHOOK_TOKEN") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json({ error: "supabase_not_configured" }, 500);
  const supplied = request.headers.get("x-maintenance-secret") || "";
  if (!maintenanceSecret || supplied !== maintenanceSecret) return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const queue = await admin.from("buyer_property_opportunities")
    .select("id,agency_id,lead_id,property_id,match_score,status,channel,leads(name,phone,email),properties(code,title,price,description,purpose,zone,bedrooms,bathrooms,parking_spaces,built_area_m2),agencies(name)")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(25);
  if (queue.error) return json({ error: queue.error.message }, 500);

  let sent = 0, reviewed = 0, failed = 0, skipped = 0;
  for (const raw of queue.data || []) {
    const item = raw as any;
    try {
      const settingsResult = await admin.from("buyer_outreach_settings").select("enabled,auto_contact,min_match_score,cooldown_hours,channels,require_explicit_consent,notify_broker").eq("agency_id", item.agency_id).maybeSingle();
      const settings = settingsResult.data as any;
      if (!settings?.enabled || !settings?.auto_contact || Number(item.match_score) < Number(settings.min_match_score || 80)) {
        await admin.from("buyer_property_opportunities").update({ status: "review", skip_reason: "Automação desativada ou oportunidade abaixo da pontuação mínima.", updated_at: new Date().toISOString() }).eq("id", item.id);
        reviewed++; continue;
      }

      const subscription = await admin.from("agency_subscriptions").select("id,status,subscription_plans(features)").eq("agency_id", item.agency_id).in("status", ["trial","active"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const features = (subscription.data as any)?.subscription_plans?.features || {};
      if (!features.ai_buyer_outreach) {
        await admin.from("buyer_property_opportunities").update({ status: "review", skip_reason: "O plano atual não inclui IA de oportunidades para compradores.", updated_at: new Date().toISOString() }).eq("id", item.id);
        reviewed++; continue;
      }

      const permissionResult = await admin.from("lead_contact_permissions").select("whatsapp_allowed,email_allowed,automated_property_alerts_allowed,revoked_at").eq("agency_id", item.agency_id).eq("lead_id", item.lead_id).maybeSingle();
      const permission = permissionResult.data as any;
      if (settings.require_explicit_consent && (!permission?.automated_property_alerts_allowed || permission?.revoked_at)) {
        await admin.from("buyer_property_opportunities").update({ status: "review", skip_reason: "Consentimento para alertas automáticos não registrado.", updated_at: new Date().toISOString() }).eq("id", item.id);
        reviewed++; continue;
      }

      const lead = item.leads || {};
      let channel = item.channel;
      let destination = "";
      if (channel === "whatsapp" && permission?.whatsapp_allowed && lead.phone) destination = String(lead.phone).replace(/\D/g, "");
      else if (channel === "email" && permission?.email_allowed && lead.email) destination = String(lead.email).trim();
      else if (settings.channels?.includes("whatsapp") && permission?.whatsapp_allowed && lead.phone) { channel = "whatsapp"; destination = String(lead.phone).replace(/\D/g, ""); }
      else if (settings.channels?.includes("email") && permission?.email_allowed && lead.email) { channel = "email"; destination = String(lead.email).trim(); }
      if (!destination) {
        await admin.from("buyer_property_opportunities").update({ status: "review", skip_reason: "Nenhum canal autorizado e disponível.", updated_at: new Date().toISOString() }).eq("id", item.id);
        reviewed++; continue;
      }

      const since = new Date(Date.now() - Number(settings.cooldown_hours || 72) * 3600000).toISOString();
      const recent = await admin.from("buyer_property_opportunities").select("id").eq("agency_id", item.agency_id).eq("lead_id", item.lead_id).eq("status", "sent").gte("sent_at", since).neq("id", item.id).limit(1);
      if ((recent.data || []).length) {
        await admin.from("buyer_property_opportunities").update({ status: "skipped", skip_reason: `Intervalo mínimo de ${settings.cooldown_hours}h ainda ativo.`, updated_at: new Date().toISOString() }).eq("id", item.id);
        skipped++; continue;
      }

      if (!aiUrl || !aiKey || !aiModel) throw new Error("Provedor de IA não configurado.");
      if (!deliveryUrl) throw new Error("Webhook de entrega não configurado.");
      const property = item.properties || {};
      const agency = item.agencies || {};
      const facts = [
        property.code && `Código: ${property.code}`,
        property.title && `Título: ${property.title}`,
        property.price != null && `Preço: R$ ${Number(property.price).toLocaleString("pt-BR")}`,
        property.purpose && `Finalidade: ${property.purpose}`,
        property.zone && `Zona: ${property.zone}`,
        property.bedrooms != null && `Quartos: ${property.bedrooms}`,
        property.bathrooms != null && `Banheiros: ${property.bathrooms}`,
        property.parking_spaces != null && `Vagas: ${property.parking_spaces}`,
        property.built_area_m2 != null && `Área construída: ${property.built_area_m2} m²`,
      ].filter(Boolean).join("\n");
      const aiResponse = await fetch(aiUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${aiKey}` }, body: JSON.stringify({ model: aiModel, messages: [
        { role: "system", content: "Você escreve mensagens curtas de uma imobiliária brasileira para um cliente que autorizou receber oportunidades. Não invente características, localização, vantagens, descontos ou condições. Não diga que o imóvel é perfeito. Explique apenas que surgiu uma opção compatível com preferências registradas e convide o cliente a pedir detalhes. Produza somente a mensagem final em português brasileiro." },
        { role: "user", content: `Imobiliária: ${agency.name || "Imobiliária"}\nCliente: ${lead.name || "cliente"}\nCompatibilidade calculada: ${item.match_score}%\nDados confirmados do imóvel:\n${facts}` },
      ], temperature: 0.35, max_tokens: 300 }) });
      const aiBody = await aiResponse.json().catch(() => null);
      if (!aiResponse.ok) throw new Error(aiBody?.error?.message || `AI HTTP ${aiResponse.status}`);
      const aiMessage = String(aiBody?.choices?.[0]?.message?.content || "").trim();
      if (!aiMessage) throw new Error("IA não retornou mensagem.");

      const delivery = await fetch(deliveryUrl, { method: "POST", headers: { "content-type": "application/json", ...(deliveryToken ? { authorization: `Bearer ${deliveryToken}` } : {}) }, body: JSON.stringify({ agency_id: item.agency_id, lead_id: item.lead_id, property_id: item.property_id, opportunity_id: item.id, channel, destination, message: aiMessage }) });
      const deliveryBody = await delivery.json().catch(() => ({}));
      if (!delivery.ok) throw new Error((deliveryBody as any)?.error || `delivery HTTP ${delivery.status}`);

      await admin.from("buyer_property_opportunities").update({ status: "sent", channel, ai_message: aiMessage, ai_provider: aiModel, sent_at: new Date().toISOString(), provider_message_id: String((deliveryBody as any)?.message_id || "") || null, last_error: null, updated_at: new Date().toISOString() }).eq("id", item.id);
      sent++;
    } catch (error) {
      await admin.from("buyer_property_opportunities").update({ status: "failed", last_error: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString() }).eq("id", item.id);
      failed++;
    }
  }
  return json({ processed: (queue.data || []).length, sent, reviewed, skipped, failed });
});
