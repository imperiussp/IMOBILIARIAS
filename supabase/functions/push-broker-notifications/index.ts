import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const internalSecret = Deno.env.get("PUSH_DISPATCH_SECRET") || "";
const oneSignalApiKey = Deno.env.get("ONESIGNAL_API_KEY") || "";
const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function errorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  return String(value);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 500);
  if (!oneSignalApiKey || !oneSignalAppId) return json({ error: "onesignal_not_configured" }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const suppliedSecret =
    request.headers.get("x-dispatch-secret") ||
    request.headers.get("x-platform-maintenance-secret") ||
    "";

  const dispatchAuthorized = Boolean(
    internalSecret && suppliedSecret && suppliedSecret === internalSecret,
  );

  let schedulerAuthorized = false;
  if (!dispatchAuthorized && suppliedSecret) {
    const verification = await supabase.rpc("verify_platform_maintenance_secret", {
      p_secret: suppliedSecret,
    });
    if (verification.error) return json({ error: "scheduler_auth_validation_failed" }, 500);
    schedulerAuthorized = verification.data === true;
  }

  if (!dispatchAuthorized && !schedulerAuthorized) return json({ error: "unauthorized" }, 401);

  const gate = await supabase.rpc("platform_runtime_action_allowed", { p_action: "push" });
  if (gate.error) return json({ error: gate.error.message }, 500);
  if (gate.data !== true) {
    return json({
      processed: 0,
      delivered: 0,
      failed: 0,
      skipped: true,
      reason: "push_blocked_by_release_or_maintenance_control",
    });
  }

  const { data: notifications, error: notificationError } = await supabase
    .from("app_notifications")
    .select("id,agency_id,user_id,title,body,lead_id,source,push_attempts")
    .is("push_sent_at", null)
    .lt("push_attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);

  if (notificationError) return json({ error: notificationError.message }, 500);
  if (!notifications?.length) return json({ processed: 0, delivered: 0, failed: 0 });

  let delivered = 0;
  let failed = 0;

  for (const notification of notifications) {
    const attempts = Number(notification.push_attempts || 0) + 1;

    try {
      const openPath = notification.lead_id
        ? `/app/?view=contatos&lead=${encodeURIComponent(notification.lead_id)}&notification=${encodeURIComponent(notification.id)}`
        : `/app/?notification=${encodeURIComponent(notification.id)}`;

      const response = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Key ${oneSignalApiKey}`,
        },
        body: JSON.stringify({
          app_id: oneSignalAppId,
          target_channel: "push",
          include_aliases: {
            external_id: [notification.user_id],
          },
          headings: {
            en: notification.title,
            pt: notification.title,
          },
          contents: {
            en: notification.body || "Você recebeu uma nova notificação no LENOY Imobiliárias.",
            pt: notification.body || "Você recebeu uma nova notificação no LENOY Imobiliárias.",
          },
          // Não usamos targetUrl aqui: em WebView nativa ele pode ser tratado pelo
          // sistema como URL externa. O app recebe openPath no callback nativo e
          // faz a navegação dentro do próprio WebView.
          data: {
            openPath,
            notificationId: notification.id,
            leadId: notification.lead_id || "",
            agencyId: notification.agency_id,
            source: notification.source,
          },
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`OneSignal ${response.status}: ${JSON.stringify(result)}`);
      }

      if (!result?.id) {
        throw new Error(`OneSignal não encontrou uma assinatura push válida para o usuário: ${JSON.stringify(result)}`);
      }

      await supabase
        .from("app_notifications")
        .update({
          push_sent_at: new Date().toISOString(),
          push_attempts: attempts,
          push_last_error: null,
        })
        .eq("id", notification.id);

      delivered += 1;
    } catch (error) {
      failed += 1;
      await supabase
        .from("app_notifications")
        .update({
          push_attempts: attempts,
          push_last_error: errorMessage(error).slice(0, 1000),
        })
        .eq("id", notification.id);
    }
  }

  return json({ processed: notifications.length, delivered, failed });
});
