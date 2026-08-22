import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const webhookSecret = Deno.env.get("INBOUND_EMAIL_SECRET") || "";
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function extractEmail(value: string) {
  const match = value.toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match?.[0] || value.toLowerCase().trim();
}

function normalizeText(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
}

function classifyResponse(text:string){
  const value=normalizeText(text);
  const optOut=["nao quero mais receber","remova meu email","remover meu email","descadastrar","sair da lista","unsubscribe","pare de enviar"];
  if(optOut.some(term=>value.includes(normalizeText(term)))) return "opt_out";
  const visit=["quero visitar","agendar visita","marcar visita","visitar o imovel"];
  if(visit.some(term=>value.includes(normalizeText(term)))) return "request_visit";
  const details=["mais detalhes","mais informacoes","quero saber mais","me passa os detalhes"];
  if(details.some(term=>value.includes(normalizeText(term)))) return "request_details";
  const negative=["nao tenho interesse","nao interessa","sem interesse"];
  if(negative.some(term=>value.includes(normalizeText(term)))) return "not_interested";
  const positive=["tenho interesse","estou interessado","estou interessada","me interessei","gostei do imovel"];
  if(positive.some(term=>value.includes(normalizeText(term)))) return "interested";
  return "reply";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!url || !serviceKey) return json({ error: "server_not_configured" }, 500);
  if (!webhookSecret || request.headers.get("x-inbound-secret") !== webhookSecret) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const toAddress = extractEmail(clean(body.to, 320));
  const fromAddress = extractEmail(clean(body.from, 320));
  const senderName = clean(body.from_name || body.name, 160);
  const subject = clean(body.subject, 300);
  const plainText = clean(body.text || body.body || body.plain, 8000);
  const providerMessageId = clean(body.message_id || body.messageId || body.id, 500);

  if (!toAddress || !fromAddress || !providerMessageId) return json({ error: "missing_required_fields" }, 400);

  const aliasResult = await supabase
    .from("agency_inbound_emails")
    .select("agency_id,broker_id,active")
    .eq("address", toAddress)
    .eq("active", true)
    .maybeSingle();
  if (aliasResult.error || !aliasResult.data) return json({ error: "unknown_recipient" }, 404);

  const duplicate = await supabase.from("inbound_email_events").select("lead_id").eq("provider_message_id", providerMessageId).maybeSingle();
  if (duplicate.data) return json({ duplicate: true, lead_id: duplicate.data.lead_id });

  const agencyId=aliasResult.data.agency_id;
  const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString();
  const attempts=await supabase.from("buyer_outreach_delivery_attempts")
    .select("id,agency_id,opportunity_id,lead_id,property_id,provider_message_id,attempted_at,leads!inner(email)")
    .eq("agency_id",agencyId)
    .eq("channel","email")
    .in("status",["sent","delivered","read"])
    .gte("attempted_at",cutoff)
    .order("attempted_at",{ascending:false})
    .limit(100);
  if(attempts.error) return json({error:attempts.error.message},500);

  const matching=(attempts.data||[]).filter((row:any)=>extractEmail(clean(row?.leads?.email,320))===fromAddress);
  const uniqueLeadIds=[...new Set(matching.map((row:any)=>row.lead_id))];
  const matchedAttempt=uniqueLeadIds.length===1?matching[0] as any:null;

  if(matchedAttempt){
    const responseText=[subject?`Assunto: ${subject}`:"",plainText].filter(Boolean).join("\n\n").trim();
    const responseKind=classifyResponse(`${subject}\n${plainText}`);
    const response=await supabase.from("buyer_outreach_responses").upsert({
      agency_id:agencyId,
      opportunity_id:matchedAttempt.opportunity_id,
      lead_id:matchedAttempt.lead_id,
      property_id:matchedAttempt.property_id,
      channel:"email",
      provider:"inbound_email",
      provider_event_id:providerMessageId,
      provider_message_id:providerMessageId,
      response_text:responseText||null,
      response_kind:responseKind,
      received_at:new Date().toISOString(),
      provider_payload:body,
    },{onConflict:"provider,provider_event_id",ignoreDuplicates:true});
    if(response.error) return json({error:response.error.message},500);

    if(responseKind==="opt_out"){
      const permission=await supabase.from("lead_contact_permissions").update({
        automated_property_alerts_allowed:false,
        email_allowed:false,
        revoked_at:new Date().toISOString(),
        updated_at:new Date().toISOString(),
      }).eq("agency_id",agencyId).eq("lead_id",matchedAttempt.lead_id);
      if(permission.error) return json({error:permission.error.message},500);
    }

    const eventResult=await supabase.from("inbound_email_events").insert({
      provider_message_id:providerMessageId,
      agency_id:agencyId,
      lead_id:matchedAttempt.lead_id,
    });
    if(eventResult.error&&eventResult.error.code!=="23505") return json({error:eventResult.error.message},500);

    return json({ok:true,kind:"buyer_outreach_reply",lead_id:matchedAttempt.lead_id,opportunity_id:matchedAttempt.opportunity_id,response_kind:responseKind});
  }

  const message = [subject ? `Assunto: ${subject}` : "", plainText].filter(Boolean).join("\n\n").trim();
  const leadResult = await supabase.from("leads").insert({
    agency_id: agencyId,
    broker_id: aliasResult.data.broker_id || null,
    name: senderName || fromAddress.split("@")[0] || "Contato por e-mail",
    phone: null,
    email: fromAddress,
    message: message || "Contato recebido por e-mail.",
    source: "email",
  }).select("id").single();

  if (leadResult.error) return json({ error: leadResult.error.message }, 500);

  const eventResult = await supabase.from("inbound_email_events").insert({
    provider_message_id: providerMessageId,
    agency_id: agencyId,
    lead_id: leadResult.data.id,
  });

  if (eventResult.error && eventResult.error.code === "23505") {
    await supabase.from("leads").delete().eq("id", leadResult.data.id);
    const existing = await supabase.from("inbound_email_events").select("lead_id").eq("provider_message_id", providerMessageId).single();
    return json({ duplicate: true, lead_id: existing.data?.lead_id || null });
  }
  if (eventResult.error) return json({ error: eventResult.error.message, lead_id: leadResult.data.id }, 500);

  return json({ ok: true, kind:"new_lead", lead_id: leadResult.data.id, agency_id: agencyId });
});
