import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "owner-property-submissions";
const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function cors(origin: string | null) {
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "Origin",
  };
}
function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "content-type": "application/json; charset=utf-8" } });
}
function text(form: FormData, key: string, max = 500) {
  return String(form.get(key) || "").trim().slice(0, max);
}
function intOrNull(value: string) {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function numberOrNull(value: string) {
  if (!value) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function cleanHostname(raw: string) {
  const value = raw.toLowerCase().trim();
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase(); }
  catch { return value.split("/")[0].split(":")[0]; }
}
function extension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "server_not_configured" }, 500, origin);

  try {
    const form = await request.formData();
    const suppliedHost = cleanHostname(text(form, "hostname", 253));
    let originHost = "";
    if (origin) { try { originHost = new URL(origin).hostname.toLowerCase(); } catch { originHost = ""; } }
    const hostname = originHost || suppliedHost;
    if (!hostname || (originHost && suppliedHost && originHost !== suppliedHost)) return json({ error: "invalid_hostname" }, 400, origin);

    const name = text(form, "name", 160);
    const phone = text(form, "phone", 40);
    const email = text(form, "email", 254).toLowerCase();
    const address = text(form, "address", 500);
    const city = text(form, "city", 160);
    const stateCode = text(form, "state_code", 2).toUpperCase();
    const neighborhood = text(form, "neighborhood", 160);
    const propertyType = text(form, "property_type", 120);
    const purposeRaw = text(form, "purpose", 20);
    const purpose = ["sale", "rent", "both"].includes(purposeRaw) ? purposeRaw : "sale";
    const bedrooms = intOrNull(text(form, "bedrooms", 4));
    const bathrooms = intOrNull(text(form, "bathrooms", 4));
    const garages = intOrNull(text(form, "garages", 4));
    const areaM2 = numberOrNull(text(form, "area_m2", 30));
    const requestedPrice = numberOrNull(text(form, "requested_price", 40));
    const caixaRaw = text(form, "caixa_financeable", 10).toLowerCase();
    const caixaFinanceable = caixaRaw === "yes" ? true : caixaRaw === "no" ? false : null;
    const description = text(form, "description", 3000);

    if (!name || !phone || !email || !email.includes("@") || !address || !city || !propertyType || !description) {
      return json({ error: "missing_required_fields" }, 400, origin);
    }

    const photos = form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
    if (!photos.length) return json({ error: "photo_required" }, 400, origin);
    if (photos.length > MAX_PHOTOS) return json({ error: "too_many_photos", max: MAX_PHOTOS }, 400, origin);
    for (const photo of photos) {
      if (!ALLOWED_TYPES.has(photo.type)) return json({ error: "invalid_photo_type" }, 400, origin);
      if (photo.size > MAX_PHOTO_BYTES) return json({ error: "photo_too_large", max_bytes: MAX_PHOTO_BYTES }, 400, origin);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const tenant = await supabase.rpc("resolve_agency_by_host", { p_hostname: hostname });
    const tenantRow = Array.isArray(tenant.data) ? tenant.data[0] : null;
    if (tenant.error || !tenantRow?.agency_id) return json({ error: "agency_not_found" }, 404, origin);
    const agencyId = String(tenantRow.agency_id);

    const purposeLabel = purpose === "rent" ? "Locação" : purpose === "both" ? "Venda ou locação" : "Venda";
    const caixaLabel = caixaFinanceable === true ? "Sim" : caixaFinanceable === false ? "Não" : "Não informado";
    const message = [
      "IMÓVEL ENVIADO PELO PROPRIETÁRIO",
      `Endereço: ${address}${neighborhood ? `, ${neighborhood}` : ""} - ${city}${stateCode ? `/${stateCode}` : ""}`,
      `Tipo: ${propertyType}`,
      `Finalidade: ${purposeLabel}`,
      `Quartos: ${bedrooms ?? "não informado"}`,
      `Banheiros: ${bathrooms ?? "não informado"}`,
      `Garagens: ${garages ?? "não informado"}`,
      `Área: ${areaM2 ?? "não informada"}${areaM2 !== null ? " m²" : ""}`,
      `Valor pedido: ${requestedPrice !== null ? requestedPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "não informado"}`,
      `Apto a financiar pela Caixa: ${caixaLabel}`,
      `Descrição: ${description}`,
    ].join("\n").slice(0, 4000);

    const lead = await supabase.rpc("create_public_lead_for_host", {
      p_hostname: hostname,
      p_property_id: null,
      p_name: name,
      p_phone: phone,
      p_email: email,
      p_message: message,
      p_source: "web-owner-property",
    });
    if (lead.error || !lead.data) return json({ error: "lead_creation_failed", detail: lead.error?.message || "" }, 500, origin);
    const leadId = String(lead.data);

    const submission = await supabase.from("owner_property_submissions").insert({
      agency_id: agencyId,
      lead_id: leadId,
      owner_name: name,
      phone,
      email,
      address,
      city,
      state_code: stateCode || null,
      neighborhood: neighborhood || null,
      property_type: propertyType,
      purpose,
      bedrooms,
      bathrooms,
      garages,
      area_m2: areaM2,
      requested_price: requestedPrice,
      caixa_financeable: caixaFinanceable,
      description,
    }).select("id").single();
    if (submission.error || !submission.data?.id) {
      await supabase.from("leads").delete().eq("id", leadId);
      return json({ error: "submission_creation_failed", detail: submission.error?.message || "" }, 500, origin);
    }
    const submissionId = String(submission.data.id);
    const uploaded: string[] = [];

    try {
      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        const path = `${agencyId}/${submissionId}/${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}.${extension(photo)}`;
        const bytes = new Uint8Array(await photo.arrayBuffer());
        const upload = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: photo.type, upsert: false, cacheControl: "3600" });
        if (upload.error) throw upload.error;
        uploaded.push(path);
        const photoRow = await supabase.from("owner_property_submission_photos").insert({
          submission_id: submissionId,
          agency_id: agencyId,
          storage_path: path,
          original_name: photo.name.slice(0, 255),
          mime_type: photo.type,
          size_bytes: photo.size,
          position: index,
        });
        if (photoRow.error) throw photoRow.error;
      }
    } catch (error) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
      await supabase.from("leads").delete().eq("id", leadId);
      return json({ error: "photo_upload_failed", detail: error instanceof Error ? error.message : String(error) }, 500, origin);
    }

    return json({ ok: true, submission_id: submissionId, lead_id: leadId, photos: uploaded.length }, 200, origin);
  } catch (error) {
    return json({ error: "invalid_request", detail: error instanceof Error ? error.message : String(error) }, 400, origin);
  }
});
