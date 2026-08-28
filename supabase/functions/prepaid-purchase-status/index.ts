import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8" } }); }
async function sha256(value: string) { const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function maskEmail(email: string) { const [name, domain] = email.split("@"); if (!domain) return ""; return `${name.slice(0, 2)}***@${domain}`; }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 500);
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const id = String(payload.purchase_id || "").trim();
  const token = String(payload.status_token || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || token.length < 20) return json({ error: "invalid_purchase" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: intent } = await admin.from("prepaid_purchase_intents")
    .select("id,email,status,billing_cycle,charge_type,amount,paid_at,invite_sent_at,invite_error,completed_at,agency_id,public_status_token_hash,subscription_plans(name,code)")
    .eq("id", id).maybeSingle();
  if (!intent) return json({ error: "purchase_not_found" }, 404);
  if ((await sha256(token)) !== intent.public_status_token_hash) return json({ error: "invalid_token" }, 403);

  return json({
    purchase_id: intent.id,
    status: intent.status,
    billing_cycle: intent.billing_cycle,
    charge_type: intent.charge_type,
    amount: Number(intent.amount || 0),
    paid: ["paid","invite_sent","onboarding","completed"].includes(intent.status),
    invite_sent: Boolean(intent.invite_sent_at),
    invite_error: intent.invite_error || null,
    completed: intent.status === "completed",
    email: maskEmail(String(intent.email || "")),
    plan: Array.isArray(intent.subscription_plans) ? intent.subscription_plans[0] : intent.subscription_plans,
  });
});
