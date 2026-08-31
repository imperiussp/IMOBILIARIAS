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

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function listStorageFiles(admin: ReturnType<typeof createClient>, bucket: string, path: string): Promise<string[]> {
  const result: string[] = [];
  let offset = 0;

  while (true) {
    const listing = await admin.storage.from(bucket).list(path, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (listing.error) throw listing.error;
    const items = listing.data || [];
    if (!items.length) break;

    for (const item of items) {
      const itemPath = path ? `${path}/${item.name}` : item.name;
      if (item.id == null) result.push(...await listStorageFiles(admin, bucket, itemPath));
      else result.push(itemPath);
    }

    if (items.length < 100) break;
    offset += items.length;
  }

  return result;
}

async function removeAgencyStorage(admin: ReturnType<typeof createClient>, agencyId: string) {
  const buckets = [
    "agency-branding",
    "agency-documents",
    "broker-photos",
    "owner-property-submissions",
    "property-photos",
  ];
  const warnings: string[] = [];

  for (const bucket of buckets) {
    try {
      const files = await listStorageFiles(admin, bucket, agencyId);
      for (let index = 0; index < files.length; index += 100) {
        const removal = await admin.storage.from(bucket).remove(files.slice(index, index + 100));
        if (removal.error) throw removal.error;
      }
    } catch (error) {
      warnings.push(`${bucket}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return warnings;
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

  let payload: { agency_id?: string; confirmation?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const agencyId = String(payload.agency_id || "").trim();
  const confirmation = String(payload.confirmation || "").trim();
  if (!agencyId) return json({ error: "agency_required" }, 400);

  const agencyResult = await admin.from("agencies").select("id,name,slug").eq("id", agencyId).maybeSingle();
  if (agencyResult.error) return json({ error: agencyResult.error.message }, 500);
  if (!agencyResult.data) return json({ error: "client_not_found" }, 404);
  const agency = agencyResult.data;

  if (!confirmation || confirmation !== String(agency.name).trim()) {
    return json({ error: "confirmation_mismatch" }, 409);
  }

  const [membershipResult, brokerResult, testAccountResult] = await Promise.all([
    admin.from("agency_memberships").select("user_id").eq("agency_id", agencyId),
    admin.from("brokers").select("user_id").eq("agency_id", agencyId).not("user_id", "is", null),
    admin.from("test_client_accounts").select("user_id").eq("agency_id", agencyId).not("user_id", "is", null),
  ]);
  const relationError = membershipResult.error || brokerResult.error || testAccountResult.error;
  if (relationError) return json({ error: relationError.message }, 500);

  const linkedUserIds = unique([
    ...(membershipResult.data || []).map((item: { user_id: string | null }) => item.user_id),
    ...(brokerResult.data || []).map((item: { user_id: string | null }) => item.user_id),
    ...(testAccountResult.data || []).map((item: { user_id: string | null }) => item.user_id),
  ]);

  if (linkedUserIds.includes(currentUser.data.user.id)) {
    return json({ error: "current_admin_account_protected" }, 409);
  }

  if (linkedUserIds.length) {
    const protectedUsers = await admin.from("platform_admins").select("user_id").in("user_id", linkedUserIds);
    if (protectedUsers.error) return json({ error: protectedUsers.error.message }, 500);
    if ((protectedUsers.data || []).length) return json({ error: "platform_admin_account_protected" }, 409);
  }

  const storageWarnings = await removeAgencyStorage(admin, agencyId);

  for (const table of ["leads", "properties", "brokers"] as const) {
    const deletion = await admin.from(table).delete().eq("agency_id", agencyId);
    if (deletion.error) return json({ error: `delete_${table}_failed`, detail: deletion.error.message }, 500);
  }

  const agencyDeletion = await admin.from("agencies").delete().eq("id", agencyId);
  if (agencyDeletion.error) return json({ error: "delete_client_failed", detail: agencyDeletion.error.message }, 500);

  const authDeleted: string[] = [];
  const authRetained: string[] = [];
  const authWarnings: string[] = [];

  for (const userId of linkedUserIds) {
    const remainingMemberships = await admin
      .from("agency_memberships")
      .select("agency_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("active", true);

    if (remainingMemberships.error) {
      authRetained.push(userId);
      authWarnings.push(`${userId}: ${remainingMemberships.error.message}`);
      continue;
    }
    if ((remainingMemberships.count || 0) > 0) {
      authRetained.push(userId);
      continue;
    }

    const deletion = await admin.auth.admin.deleteUser(userId, false);
    if (deletion.error) {
      authRetained.push(userId);
      authWarnings.push(`${userId}: ${deletion.error.message}`);
      await admin.from("user_roles").delete().eq("user_id", userId);
    } else {
      authDeleted.push(userId);
    }
  }

  return json({
    ok: true,
    deleted_agency_id: agencyId,
    deleted_client: agency.name,
    auth_users_deleted: authDeleted.length,
    auth_users_retained: authRetained.length,
    warnings: [...storageWarnings, ...authWarnings],
  });
});
