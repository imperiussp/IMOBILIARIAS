import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "owner-property-submissions";

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
    if (userResult.error || !userResult.data.user) return json({ error: "unauthorized" }, 401, origin);

    // A consulta pelo cliente autenticado usa as mesmas regras de acesso do painel.
    const lookup = await userClient
      .from("owner_property_submissions")
      .select("id,agency_id,status,published_property_id")
      .eq("id", submissionId)
      .maybeSingle();
    if (lookup.error) return json({ error: "submission_lookup_failed", detail: lookup.error.message }, 500, origin);
    const submission = lookup.data;
    if (!submission) return json({ error: "submission_not_found" }, 404, origin);
    if (submission.status !== "pending" || submission.published_property_id) {
      return json({ error: "published_submission_cannot_be_deleted_here", detail: "Imóveis já publicados devem ser administrados em Imóveis cadastrados." }, 409, origin);
    }

    const photoResult = await service
      .from("owner_property_submission_photos")
      .select("storage_path")
      .eq("submission_id", submissionId)
      .eq("agency_id", submission.agency_id);
    if (photoResult.error) return json({ error: "photo_lookup_failed", detail: photoResult.error.message }, 500, origin);
    const paths = (photoResult.data || []).map((row) => String(row.storage_path || "")).filter(Boolean);

    // Excluir o registro primeiro mantém o banco consistente; as linhas das fotos saem por CASCADE.
    const deletion = await service
      .from("owner_property_submissions")
      .delete()
      .eq("id", submissionId)
      .eq("agency_id", submission.agency_id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (deletion.error) return json({ error: "submission_delete_failed", detail: deletion.error.message }, 500, origin);
    if (!deletion.data?.id) return json({ error: "submission_not_deleted" }, 409, origin);

    let storageWarning: string | null = null;
    if (paths.length) {
      const removal = await service.storage.from(BUCKET).remove(paths);
      if (removal.error) storageWarning = removal.error.message;
    }

    return json({ ok: true, submission_id: submissionId, removed_photos: paths.length, storage_warning: storageWarning }, 200, origin);
  } catch (error) {
    return json({ error: "delete_failed", detail: error instanceof Error ? error.message : String(error) }, 500, origin);
  }
});
