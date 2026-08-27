"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  lead_id: string | null;
  source: string | null;
  kind: string | null;
  event_key: string | null;
  source_response_id: string | null;
};

type AppView = "home" | "imoveis" | "contatos" | "emails" | "visitas" | "documentos" | "acompanhamentos" | "oportunidades" | "entregas" | "meu-plano" | "corretores";

type NotificationTarget = { appView: AppView; adminHash: string; includeLead: boolean };

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function notificationTarget(row: NotificationRow): NotificationTarget {
  const text = normalize([row.kind, row.source, row.event_key, row.title, row.body].filter(Boolean).join(" "));

  if (text.includes("imovel para avaliacao") || text.includes("owner property") || text.includes("owner_property") || text.includes("owner-property")) {
    return { appView: "imoveis", adminHash: "imoveis", includeLead: true };
  }
  if (text.includes("e-mail") || text.includes("email") || text.includes("webmail") || text.includes("mailbox")) {
    return { appView: "emails", adminHash: "emails-profissionais", includeLead: false };
  }
  if (text.includes("visita") || text.includes("appointment") || text.includes("agenda")) {
    return { appView: "visitas", adminHash: "agenda-visitas", includeLead: true };
  }
  if (text.includes("document")) {
    return { appView: "documentos", adminHash: "documentos", includeLead: true };
  }
  if (text.includes("followup") || text.includes("follow-up") || text.includes("acompanhamento") || text.includes("retorno")) {
    return { appView: "acompanhamentos", adminHash: "acompanhamentos", includeLead: true };
  }
  if (text.includes("oportunidade") || text.includes("match")) {
    return { appView: "oportunidades", adminHash: "oportunidades-ia", includeLead: true };
  }
  if (text.includes("entrega") || text.includes("delivery")) {
    return { appView: "entregas", adminHash: "entregas-oportunidades", includeLead: true };
  }
  if (text.includes("plano") || text.includes("assinatura") || text.includes("subscription") || text.includes("pagamento")) {
    return { appView: "meu-plano", adminHash: "meu-plano", includeLead: false };
  }
  if (text.includes("corretor") || text.includes("broker")) {
    return { appView: "corretores", adminHash: "corretores", includeLead: false };
  }
  if (text.includes("imovel") || text.includes("property")) {
    return { appView: "imoveis", adminHash: "imoveis", includeLead: Boolean(row.lead_id) };
  }
  if (row.lead_id) return { appView: "contatos", adminHash: "contatos", includeLead: true };
  return { appView: "home", adminHash: "visao-geral", includeLead: false };
}

function notificationHref(row: NotificationRow) {
  const target = notificationTarget(row);
  const params = new URLSearchParams();
  if (target.appView !== "home") params.set("view", target.appView);
  if (target.includeLead && row.lead_id) params.set("lead", row.lead_id);
  params.set("notification", row.id);

  if (window.location.pathname.includes("/app")) {
    return target.appView === "home" ? `/app/?${params.toString()}` : `/app/?${params.toString()}`;
  }

  const adminParams = new URLSearchParams();
  if (target.includeLead && row.lead_id) adminParams.set("lead", row.lead_id);
  adminParams.set("notification", row.id);
  return `/admin/?${adminParams.toString()}#${target.adminHash}`;
}

export default function WebNotificationBellMount() {
  const [target, setTarget] = useState<Element | null>(null);
  const [agencyId, setAgencyId] = useState("");
  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const unread = useMemo(() => rows.length, [rows]);

  useEffect(() => {
    if (!supabaseBrowser) return;
    const pathname = window.location.pathname;
    if (!pathname.includes("/admin") && !pathname.includes("/app")) return;

    let disposed = false;
    let observer: MutationObserver | null = null;

    const resolveTarget = () => {
      const next = pathname.includes("/admin")
        ? document.querySelector(".adminHeadingActions") || document.querySelector(".adminNav")
        : document.querySelector(".mobileAppTopbar");
      if (next && !disposed) {
        setTarget(next);
        observer?.disconnect();
      }
    };

    resolveTarget();
    observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    void (async () => {
      const [{ data: sessionData }, agency] = await Promise.all([
        supabaseBrowser!.auth.getSession(),
        getCurrentAgency(),
      ]);
      if (disposed) return;
      const uid = sessionData.session?.user?.id || "";
      if (!uid || !agency) {
        setReady(true);
        return;
      }
      setUserId(uid);
      setAgencyId(agency.agencyId);
      setReady(true);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  async function load() {
    if (!supabaseBrowser || !agencyId || !userId) return;
    const { data, error } = await supabaseBrowser
      .from("app_notifications")
      .select("id,title,body,read_at,created_at,lead_id,source,kind,event_key,source_response_id")
      .eq("agency_id", agencyId)
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setRows((data || []) as NotificationRow[]);
  }

  useEffect(() => {
    if (!agencyId || !userId) return;
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    const onVisibility = () => { if (!document.hidden) void load(); };
    const onNativeOpened = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      const id = typeof detail.notificationId === "string" ? detail.notificationId : "";
      setOpen(false);
      if (id) setRows((current) => current.filter((row) => row.id !== id));
      else void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("lenoy:notification-opened", onNativeOpened as EventListener);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("lenoy:notification-opened", onNativeOpened as EventListener);
    };
  }, [agencyId, userId]);

  async function markRead(id: string) {
    if (!supabaseBrowser || !agencyId || !userId) return false;
    const removed = rows.find((row) => row.id === id) || null;
    setRows((current) => current.filter((row) => row.id !== id));
    const now = new Date().toISOString();
    const { error } = await supabaseBrowser
      .from("app_notifications")
      .update({ read_at: now })
      .eq("id", id)
      .eq("agency_id", agencyId)
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      if (removed) setRows((current) => current.some((row) => row.id === removed.id) ? current : [removed, ...current]);
      return false;
    }
    return true;
  }

  async function openNotification(row: NotificationRow) {
    setOpen(false);
    const href = notificationHref(row);
    await markRead(row.id);
    window.location.assign(href);
  }

  async function markAllRead() {
    if (!supabaseBrowser || !agencyId || !userId || !unread) return;
    const previous = rows;
    setRows([]);
    const now = new Date().toISOString();
    const { error } = await supabaseBrowser
      .from("app_notifications")
      .update({ read_at: now })
      .eq("agency_id", agencyId)
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) setRows(previous);
  }

  if (!ready || !target || !agencyId || !userId) return null;

  return createPortal(
    <div className={`webNotificationBellWrap${open ? " open" : ""}`}>
      <button className="webNotificationBell" type="button" aria-label={unread ? `${unread} notificações não lidas` : "Notificações"} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) void load(); }}>
        <span aria-hidden="true">♢</span>
        {unread > 0 ? <b>{unread > 99 ? "99+" : unread}</b> : null}
      </button>
      {open ? <div className="webNotificationPanel" role="dialog" aria-label="Notificações">
        <div className="webNotificationHead"><div><strong>Notificações</strong><small>{unread ? `${unread} nova(s)` : "Tudo em dia"}</small></div>{unread ? <button type="button" onClick={() => void markAllRead()}>Marcar todas como lidas</button> : null}</div>
        <div className="webNotificationList">
          {rows.length ? rows.map((row) => <button key={row.id} type="button" className="webNotificationItem unread" onClick={() => void openNotification(row)}>
            <span className="webNotificationDot" aria-hidden="true"></span>
            <span><strong>{row.title}</strong>{row.body ? <small>{row.body}</small> : null}<em>{timeLabel(row.created_at)}</em></span>
          </button>) : <div className="webNotificationEmpty">Nenhuma notificação nova.</div>}
        </div>
      </div> : null}
    </div>,
    target,
  );
}
