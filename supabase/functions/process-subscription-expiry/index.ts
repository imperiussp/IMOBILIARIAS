import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const expectedSecret = Deno.env.get("BILLING_MAINTENANCE_SECRET") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey || !expectedSecret) return json({ error: "server_not_configured" }, 503);

  const supplied = request.headers.get("x-billing-maintenance-secret") || "";
  if (supplied !== expectedSecret) return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("expire_due_agency_subscriptions");
  if (error) return json({ error: error.message }, 500);

  return json({ success: true, expired_subscriptions: Number(data || 0), processed_at: new Date().toISOString() });
});
