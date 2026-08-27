import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SOURCE_BUCKET = "owner-property-submissions";
const TARGET_BUCKET = "property-photos";

function cors(origin: string | null) {
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "content-type": "application/json; charset=utf-8" },
  });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function propertyCode() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(6, "0").slice(-6);
  return `IM-${stamp}${random}`;
}

function fileExtension(path: string, mime: string | null) {
  const fromPath = path.split(".").pop()?.toLowerCase();
  if (fromPath && ["jpg", "jpeg", "png", "webp"].includes(fromPath)) return fromPath === "jpeg" ? "jpg" : fromPath;
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE) return json({ error: "server_not_configured" }, 500, origin);

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401, origin);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const service = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const payload = await request.json().catch(() => ({}));
    const submissionId = String(payload?.submission_id || "").trim();
    if (!submissionId) return json({ error: "submission_required" }, 400, origin);

    const userResult = await userClient.auth.getUser();
    const user = userResult.data.user;
    if (userResult.error || !user) return json({ error: "unauthorized" }, 401, origin);

    const submissionResult = await userClient
      .from("owner_property_submissions")
      .select("id,agency_id,lead_id,title,status,published_property_id,owner_name,phone,email,address,city,state_code,neighborhood,property_type,purpose,bedrooms,bathrooms,garages,area_m2,requested_price,caixa_financeable,description")
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionResult.error) return json({ error: "submission_lookup_failed", detail: submissionResult.error.message }, 500, origin);
    const submission = submissionResult.data;
    if (!submission) return json({ error: "submission_not_found" }, 404, origin);

    if (submission.status === "published" && submission.published_property_id) {
      return json({ ok: true, already_published: true, property_id: submission.published_property_id }, 200, origin);
    }

    if (submission.purpose !== "sale" && submission.purpose !== "rent") {
      return json({ error: "purpose_requires_broker_choice", detail: "Escolha Venda ou Locação antes de publicar." }, 409, origin);
    }

    const limit = await userClient.rpc("agency_can_create_property", { p_agency_id: submission.agency_id });
    if (limit.error) return json({ error: "plan_validation_failed", detail: limit.error.message }, 500, origin);
    if (limit.data === false) return json({ error: "property_limit_reached", detail: "O plano atingiu o limite de imóveis ativos." }, 409, origin);

    const stateCode = String(submission.state_code || "").toUpperCase();
    if (!stateCode || !submission.city) return json({ error: "location_incomplete", detail: "Revise estado e cidade antes de publicar." }, 409, origin);

    const cityResult = await userClient.rpc("mobile_broker_resolve_city", {
      p_agency_id: submission.agency_id,
      p_name: submission.city,
      p_state_code: stateCode,
    });
    if (cityResult.error) return json({ error: "city_resolution_failed", detail: cityResult.error.message }, 500, origin);
    const cityRow = Array.isArray(cityResult.data) ? cityResult.data[0] : cityResult.data;
    const cityId = cityRow?.id ? String(cityRow.id) : "";
    if (!cityId) return json({ error: "city_resolution_failed" }, 500, origin);

    let neighborhoodId: string | null = null;
    if (submission.neighborhood) {
      const neighborhoodResult = await userClient.rpc("mobile_broker_resolve_neighborhood", {
        p_agency_id: submission.agency_id,
        p_city_id: cityId,
        p_name: submission.neighborhood,
      });
      if (neighborhoodResult.error) return json({ error: "neighborhood_resolution_failed", detail: neighborhoodResult.error.message }, 500, origin);
      const neighborhoodRow = Array.isArray(neighborhoodResult.data) ? neighborhoodResult.data[0] : neighborhoodResult.data;
      neighborhoodId = neighborhoodRow?.id ? String(neighborhoodRow.id) : null;
    }

    const typeResult = await userClient.rpc("mobile_broker_resolve_property_type", {
      p_agency_id: submission.agency_id,
      p_name: submission.property_type,
    });
    if (typeResult.error) return json({ error: "property_type_resolution_failed", detail: typeResult.error.message }, 500, origin);
    const typeRow = Array.isArray(typeResult.data) ? typeResult.data[0] : typeResult.data;
    const propertyTypeId = typeRow?.id ? String(typeRow.id) : null;

    const brokerResult = await service
      .from("brokers")
      .select("id")
      .eq("agency_id", submission.agency_id)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    const brokerId = brokerResult.data?.id || null;

    const code = propertyCode();
    const title = String(submission.title || "").trim() || `${submission.property_type} em ${submission.neighborhood || submission.city}`;
    const now = new Date().toISOString();
    let propertyId = "";
    const uploadedPaths: string[] = [];

    try {
      const inserted = await service
        .from("properties")
        .insert({
          agency_id: submission.agency_id,
          code,
          title,
          slug: `${slugify(title)}-${code.toLowerCase()}`,
          broker_id: brokerId,
          city_id: cityId,
          neighborhood_id: neighborhoodId,
          property_type_id: propertyTypeId,
          description: submission.description || null,
          purpose: submission.purpose,
          zone: "urban",
          segment: "residential",
          publication_state: "published",
          status: "available",
          price: Number(submission.requested_price || 0),
          bedrooms: submission.bedrooms,
          suites: 0,
          bathrooms: submission.bathrooms,
          parking_spaces: submission.garages,
          built_area_m2: submission.area_m2,
          land_area_m2: null,
          address: submission.address || null,
          address_public: false,
          featured: false,
          financing_accepted: submission.caixa_financeable,
          published_at: now,
        })
        .select("id")
        .single();
      if (inserted.error || !inserted.data?.id) throw inserted.error || new Error("property_creation_failed");
      propertyId = String(inserted.data.id);

      const photoResult = await service
        .from("owner_property_submission_photos")
        .select("storage_path,mime_type,position")
        .eq("submission_id", submissionId)
        .eq("agency_id", submission.agency_id)
        .order("position", { ascending: true });
      if (photoResult.error) throw photoResult.error;

      for (const [index, photo] of (photoResult.data || []).entries()) {
        const source = await service.storage.from(SOURCE_BUCKET).download(photo.storage_path);
        if (source.error || !source.data) throw source.error || new Error("source_photo_download_failed");
        const mime = photo.mime_type || source.data.type || "image/jpeg";
        const ext = fileExtension(photo.storage_path, mime);
        const targetPath = `${submission.agency_id}/${propertyId}/owner/${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}.${ext}`;
        const bytes = new Uint8Array(await source.data.arrayBuffer());
        const upload = await service.storage.from(TARGET_BUCKET).upload(targetPath, bytes, {
          contentType: mime,
          cacheControl: "31536000",
          upsert: false,
        });
        if (upload.error) throw upload.error;
        uploadedPaths.push(targetPath);

        const photoInsert = await service.from("property_photos").insert({
          property_id: propertyId,
          storage_path: targetPath,
          thumbnail_path: null,
          position: index,
          is_cover: index === 0,
          alt_text: `${title} - foto ${index + 1}`,
        });
        if (photoInsert.error) throw photoInsert.error;
      }

      const submissionUpdate = await service
        .from("owner_property_submissions")
        .update({ status: "published", published_property_id: propertyId, published_at: now })
        .eq("id", submissionId)
        .eq("agency_id", submission.agency_id);
      if (submissionUpdate.error) throw submissionUpdate.error;

      if (submission.lead_id) {
        await service.from("leads").update({ property_id: propertyId }).eq("id", submission.lead_id).eq("agency_id", submission.agency_id);
      }

      return json({ ok: true, property_id: propertyId }, 200, origin);
    } catch (error) {
      if (uploadedPaths.length) await service.storage.from(TARGET_BUCKET).remove(uploadedPaths);
      if (propertyId) {
        await service.from("property_photos").delete().eq("property_id", propertyId);
        await service.from("properties").delete().eq("id", propertyId).eq("agency_id", submission.agency_id);
      }
      throw error;
    }
  } catch (error) {
    return json({ error: "publish_failed", detail: error instanceof Error ? error.message : String(error) }, 500, origin);
  }
});
