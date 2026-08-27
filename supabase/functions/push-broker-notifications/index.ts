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

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

type NotificationRecord = {
  id: string;
  agency_id: string;
  user_id: string;
  title: string;
  body: string | null;
  lead_id: string | null;
  source: string | null;
  kind: string | null;
  event_key: string | null;
  source_response_id: string | null;
  push_attempts: number | null;
};

function openPathFor(notification: NotificationRecord) {
  const text = normalize([
    notification.kind,
    notification.source,
    notification.event_key,
    notification.title,
    notification.body,
  ].filter(Boolean).join(" "));

  let view = "home";
  let includeLead = false;

  if (text.includes("imovel para avaliacao") || text.includes("owner property") || text.includes("owner_property") || text.includes("owner-property")) {
    view = "imoveis";
    includeLead = true;
  } else if (text.includes("e-mail") || text.includes("email") || text.includes("webmail") || text.includes("mailbox")) {
    view = "emails";
  } else if (text.includes("visita") || text.includes("appointment") || text.includes("agenda")) {
    view = "visitas";
    includeLead = true;
  } else if (text.includes("document")) {
    view = "documentos";
    includeLead = true;
  } else if (text.includes("followup") || text.includes("follow-up") || text.includes("acompanhamento") || text.includes("retorno")) {
    view = "acompanhamentos";
    includeLead = true;
  } else if (text.includes("oportunidade") || text.includes("match")) {
    view = "oportunidades";
    includeLead = true;
  } else if (text.includes("entrega") || text.includes("delivery")) {
    view = "entregas";
    includeLead = true;
  } else if (text.includes("plano") || text.includes("assinatura") || text.includes("subscription") || text.includes("pagamento")) {
    view = "meu-plano";
  } else if (text.includes("corretor") || text.includes("broker")) {
    view = "corretores";
  } else if (text.includes("imovel") || text.includes("property")) {
    view = "imoveis";
    includeLead = Boolean(notification.lead_id);
  } else if (notification.lead_id) {
    view = "contatos";
    includeLead = true;
  }

  const params = new URLSearchParams();
  if (view !== "home") params.set("view", view);
  if (includeLead && notification.lead_id) params.set("lead", notification.lead_id);
  params.set("notification", notification.id);
  return `/app/?${params.toString()}`;
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
    .select("id,agency_id,user_id,title,body,lead_id,source,kind,event_key,source_response_id,push_attempts")
    .is("push_sent_at", null)
    .is("read_at", null)
    .lt("push_attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);

  if (notificationError) return json({ error: notificationError.message }, 500);
  if (!notifications?.length) return json({ processed: 0, delivered: 0, failed: 0 });

  let delivered = 0;
  let failed = 0;

  for (const rawNotification of notifications) {
    const notification = rawNotification as NotificationRecord;
    const attempts = Number(notification.push_attempts || 0) + 1;

    try {
      const openPath = openPathFor(notification);

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
          data: {
            openPath,
            notificationId: notification.id,
            leadId: notification.lead_id || "",
            agencyId: notification.agency_id,
            source: notification.source || "",
            kind: notification.kind || "",
            eventKey: notification.event_key || "",
            sourceResponseId: notification.source_response_id || "",
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
