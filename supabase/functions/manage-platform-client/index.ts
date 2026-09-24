import { createClient } from "jsr:@supabase/supabase-js@2.112.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function validSlug(value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_not_configured" }, 503);

  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const currentUser = await userClient.auth.getUser();
  if (currentUser.error || !currentUser.data.user) return json({ error: "unauthorized" }, 401);

  const adminCheck = await userClient.rpc("is_platform_admin");
  if (adminCheck.error || adminCheck.data !== true) return json({ error: "platform_admin_required" }, 403);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = clean(payload.action);

  if (action === "create") {
    const name = clean(payload.name);
    const email = clean(payload.email).toLowerCase();
    const slug = clean(payload.slug).toLowerCase();
    const whatsapp = clean(payload.whatsapp);
    const planId = clean(payload.plan_id) || null;
    const billingCycle = clean(payload.billing_cycle) || "monthly";
    const agencyStatus = clean(payload.agency_status) || "pending_payment";
    const subscriptionStatus = clean(payload.subscription_status) || "none";
    const implementationStatus = clean(payload.implementation_status) || "pending";

    if (!name) return json({ error: "name_required" }, 400);
    if (!email || !email.includes("@")) return json({ error: "valid_email_required" }, 400);
    if (!validSlug(slug)) return json({ error: "valid_slug_required" }, 400);
    if (!["monthly", "annual"].includes(billingCycle)) return json({ error: "invalid_billing_cycle" }, 400);
    if (!["pending_payment", "trial", "active", "past_due", "suspended", "cancelled"].includes(agencyStatus)) return json({ error: "invalid_agency_status" }, 400);
    if (!["none", "trial", "active", "past_due", "cancelled", "expired"].includes(subscriptionStatus)) return json({ error: "invalid_subscription_status" }, 400);
    if (!["pending", "paid", "waived"].includes(implementationStatus)) return json({ error: "invalid_implementation_status" }, 400);
    if (subscriptionStatus !== "none" && !planId) return json({ error: "plan_required_for_subscription" }, 400);

    const duplicateAgency = await admin.from("agencies").select("id").eq("slug", slug).maybeSingle();
    if (duplicateAgency.error) return json({ error: duplicateAgency.error.message }, 500);
    if (duplicateAgency.data) return json({ error: "slug_already_used" }, 409);

    if (planId) {
      const plan = await admin.from("subscription_plans").select("id").eq("id", planId).maybeSingle();
      if (plan.error) return json({ error: plan.error.message }, 500);
      if (!plan.data) return json({ error: "plan_not_found" }, 404);
    }

    const invitation = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: name,
        onboarding_kind: "platform_admin_created",
      },
      redirectTo: "https://imoveis.lenoy.com.br/login/",
    });
    if (invitation.error || !invitation.data.user) {
      const detail = invitation.error?.message || "invite_failed";
      return json({ error: "owner_invite_failed", detail }, 409);
    }

    const ownerId = invitation.data.user.id;
    let agencyId = "";

    try {
      const agencyInsert = await admin.from("agencies").insert({
        name,
        slug,
        email,
        whatsapp: whatsapp || null,
        status: agencyStatus,
      }).select("id").single();
      if (agencyInsert.error || !agencyInsert.data) throw agencyInsert.error || new Error("agency_insert_failed");
      agencyId = agencyInsert.data.id;

      const membership = await admin.from("agency_memberships").insert({
        agency_id: agencyId,
        user_id: ownerId,
        role: "owner",
        active: true,
      });
      if (membership.error) throw membership.error;

      const domain = await admin.from("agency_domains").insert({
        agency_id: agencyId,
        hostname: `${slug}.imoveis.lenoy.com.br`,
        kind: "platform",
        is_primary: true,
        verified: true,
        verified_at: new Date().toISOString(),
      });
      if (domain.error) throw domain.error;

      const profile = await admin.from("agency_billing_profiles").upsert({
        agency_id: agencyId,
        implementation_status: implementationStatus,
        implementation_paid_at: implementationStatus === "paid" ? new Date().toISOString() : null,
        implementation_waived_at: implementationStatus === "waived" ? new Date().toISOString() : null,
        billing_cycle: billingCycle,
        updated_at: new Date().toISOString(),
      });
      if (profile.error) throw profile.error;

      if (planId && subscriptionStatus !== "none") {
        const subscription = await admin.from("agency_subscriptions").insert({
          agency_id: agencyId,
          plan_id: planId,
          status: subscriptionStatus,
          starts_at: new Date().toISOString(),
          provider: "platform-admin",
          billing_cycle: billingCycle,
          updated_at: new Date().toISOString(),
        });
        if (subscription.error) throw subscription.error;
      }

      return json({
        ok: true,
        agency_id: agencyId,
        owner_user_id: ownerId,
        invite_sent: true,
      });
    } catch (error) {
      if (agencyId) await admin.from("agencies").delete().eq("id", agencyId);
      await admin.auth.admin.deleteUser(ownerId, false);
      return json({
        error: "create_client_failed",
        detail: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  }

  if (action === "update_identity") {
    const agencyId = clean(payload.agency_id);
    const name = clean(payload.name);
    const email = clean(payload.email).toLowerCase();
    const slug = clean(payload.slug).toLowerCase();
    const whatsapp = clean(payload.whatsapp);

    if (!agencyId) return json({ error: "agency_required" }, 400);
    if (!name) return json({ error: "name_required" }, 400);
    if (!email || !email.includes("@")) return json({ error: "valid_email_required" }, 400);
    if (!validSlug(slug)) return json({ error: "valid_slug_required" }, 400);

    const agencyResult = await admin.from("agencies").select("id,slug,email").eq("id", agencyId).maybeSingle();
    if (agencyResult.error) return json({ error: agencyResult.error.message }, 500);
    if (!agencyResult.data) return json({ error: "client_not_found" }, 404);

    const duplicate = await admin.from("agencies").select("id").eq("slug", slug).neq("id", agencyId).maybeSingle();
    if (duplicate.error) return json({ error: duplicate.error.message }, 500);
    if (duplicate.data) return json({ error: "slug_already_used" }, 409);

    const ownerResult = await admin
      .from("agency_memberships")
      .select("user_id")
      .eq("agency_id", agencyId)
      .eq("role", "owner")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (ownerResult.error) return json({ error: ownerResult.error.message }, 500);

    if (ownerResult.data?.user_id && email !== String(agencyResult.data.email || "").toLowerCase()) {
      const userUpdate = await admin.auth.admin.updateUserById(ownerResult.data.user_id, {
        email,
        email_confirm: true,
      });
      if (userUpdate.error) return json({ error: "owner_email_update_failed", detail: userUpdate.error.message }, 409);
    }

    const agencyUpdate = await admin.from("agencies").update({
      name,
      email,
      whatsapp: whatsapp || null,
      slug,
      updated_at: new Date().toISOString(),
    }).eq("id", agencyId);
    if (agencyUpdate.error) return json({ error: "agency_update_failed", detail: agencyUpdate.error.message }, 500);

    if (slug !== agencyResult.data.slug) {
      const domainUpdate = await admin.from("agency_domains").update({
        hostname: `${slug}.imoveis.lenoy.com.br`,
        verified: true,
        verified_at: new Date().toISOString(),
      }).eq("agency_id", agencyId).eq("kind", "platform");
      if (domainUpdate.error) return json({ error: "domain_update_failed", detail: domainUpdate.error.message }, 500);
    }

    return json({ ok: true });
  }

  return json({ error: "unsupported_action" }, 400);
});
