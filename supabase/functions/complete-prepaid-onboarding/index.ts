import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8" } }); }
async function sha256(value: string) { const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-").slice(0, 48); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_not_configured" }, 500);

  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.email) return json({ error: "unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const intentId = String(payload.purchase_id || "").trim();
  const token = String(payload.onboarding_token || "").trim();
  const fullName = String(payload.full_name || "").trim();
  const agencyName = String(payload.agency_name || "").trim();
  const agencySlug = slugify(String(payload.agency_slug || "").trim());
  const password = String(payload.password || "");
  if (!/^[0-9a-f-]{36}$/i.test(intentId) || token.length < 20) return json({ error: "invalid_purchase" }, 400);
  if (!fullName || !agencyName || agencySlug.length < 3) return json({ error: "complete_data_required" }, 400);
  if (password.length < 8) return json({ error: "password_too_short" }, 400);

  const { data: intent, error: intentError } = await admin.from("prepaid_purchase_intents")
    .select("id,email,status,onboarding_token_hash,onboarding_expires_at,auth_user_id,agency_id")
    .eq("id", intentId).maybeSingle();
  if (intentError || !intent) return json({ error: "purchase_not_found" }, 404);
  if (intent.status === "completed" && intent.agency_id) return json({ ok: true, agency_id: intent.agency_id, redirect: "/admin/" });
  if (!["paid","invite_sent","onboarding"].includes(intent.status)) return json({ error: "payment_not_confirmed" }, 409);
  if (String(intent.email || "").toLowerCase() !== String(userData.user.email || "").toLowerCase()) return json({ error: "email_mismatch" }, 403);
  if (intent.auth_user_id && intent.auth_user_id !== userData.user.id) return json({ error: "user_mismatch" }, 403);
  if (!intent.onboarding_token_hash || (await sha256(token)) !== intent.onboarding_token_hash) return json({ error: "invalid_onboarding_token" }, 403);
  if (intent.onboarding_expires_at && new Date(intent.onboarding_expires_at).getTime() < Date.now()) return json({ error: "onboarding_link_expired" }, 410);

  const available = await admin.rpc("agency_slug_available", { p_slug: agencySlug });
  if (available.error || available.data !== true) return json({ error: "slug_unavailable" }, 409);

  const userUpdate = await admin.auth.admin.updateUserById(userData.user.id, {
    password,
    user_metadata: { ...(userData.user.user_metadata || {}), full_name: fullName, onboarding_kind: "agency_owner_completed", purchase_intent_id: intentId },
  });
  if (userUpdate.error) return json({ error: userUpdate.error.message }, 500);

  await admin.from("prepaid_purchase_intents").update({ status: "onboarding", auth_user_id: userData.user.id, updated_at: new Date().toISOString() }).eq("id", intentId);
  const completion = await admin.rpc("complete_prepaid_agency_onboarding", {
    p_intent_id: intentId,
    p_user_id: userData.user.id,
    p_agency_name: agencyName,
    p_agency_slug: agencySlug,
  });
  if (completion.error) return json({ error: completion.error.message }, 500);
  return json({ ok: true, agency_id: completion.data, redirect: "/admin/" });
});
