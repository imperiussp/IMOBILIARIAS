import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const internalSecret = Deno.env.get("PUSH_DISPATCH_SECRET") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 500);
  if (!internalSecret) return json({ error: "push_dispatch_secret_not_configured" }, 503);
  if (request.headers.get("x-dispatch-secret") !== internalSecret) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const gate = await supabase.rpc("platform_runtime_action_allowed", { p_action: "push" });
  if (gate.error) return json({ error: gate.error.message }, 500);
  if (gate.data !== true) return json({ processed: 0, delivered: 0, skipped: true, reason: "push_blocked_by_release_or_maintenance_control" });

  const { data: notifications, error: notificationError } = await supabase
    .from("app_notifications")
    .select("id,agency_id,user_id,title,body,lead_id,source,push_attempts")
    .is("push_sent_at", null)
    .lt("push_attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);

  if (notificationError) return json({ error: notificationError.message }, 500);
  if (!notifications?.length) return json({ processed: 0, delivered: 0 });

  let delivered = 0;
  let partiallyDelivered = 0;
  for (const notification of notifications) {
    const { data: tokens, error: tokenError } = await supabase
      .from("device_push_tokens")
      .select("id,token")
      .eq("agency_id", notification.agency_id)
      .eq("user_id", notification.user_id)
      .eq("enabled", true);

    if (tokenError) {
      await supabase.from("app_notifications").update({
        push_attempts: Number(notification.push_attempts || 0) + 1,
        push_last_error: tokenError.message.slice(0,1000),
      }).eq("id", notification.id);
      continue;
    }

    if (!tokens?.length) {
      await supabase.from("app_notifications").update({
        push_attempts: Number(notification.push_attempts || 0) + 1,
        push_last_error: "Nenhum dispositivo ativo para este usuário.",
      }).eq("id", notification.id);
      continue;
    }

    const messages = tokens.map((row) => ({
      to: row.token,
      sound: "default",
      channelId: "clientes",
      title: notification.title,
      body: notification.body || "Você recebeu uma nova mensagem de cliente.",
      data: {
        notificationId: notification.id,
        leadId: notification.lead_id || "",
        agencyId: notification.agency_id,
        source: notification.source,
      },
    }));

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(messages),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`Expo Push ${response.status}: ${JSON.stringify(result)}`);

      const tickets = Array.isArray(result?.data) ? result.data : [];
      const failedTokens = tokens.filter((_, index) => tickets[index]?.status === "error");
      if (failedTokens.length === tokens.length) {
        const detail = tickets.map((ticket: any) => ticket?.message || ticket?.details?.error || "push_error").join("; ");
        throw new Error(detail || "Falha no envio push.");
      }

      for (const [index, ticket] of tickets.entries()) {
        if (ticket?.status === "error" && ["DeviceNotRegistered", "InvalidCredentials"].includes(ticket?.details?.error)) {
          const tokenRow = tokens[index];
          if (tokenRow?.id) await supabase.from("device_push_tokens").update({ enabled: false }).eq("id", tokenRow.id);
        }
      }

      await supabase.from("app_notifications").update({
        push_sent_at: new Date().toISOString(),
        push_attempts: Number(notification.push_attempts || 0) + 1,
        push_last_error: failedTokens.length ? `${failedTokens.length} dispositivo(s) recusaram a notificação.` : null,
      }).eq("id", notification.id);
      delivered += 1;
      if (failedTokens.length) partiallyDelivered += 1;
    } catch (error) {
      await supabase.from("app_notifications").update({
        push_attempts: Number(notification.push_attempts || 0) + 1,
        push_last_error: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
      }).eq("id", notification.id);
    }
  }

  return json({ processed: notifications.length, delivered, partially_delivered: partiallyDelivered });
});
