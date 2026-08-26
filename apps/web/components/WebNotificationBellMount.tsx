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
};

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function WebNotificationBellMount() {
  const [target, setTarget] = useState<Element | null>(null);
  const [agencyId, setAgencyId] = useState("");
  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const unread = useMemo(() => rows.filter((row) => !row.read_at).length, [rows]);

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
    if (!target) {
      observer = new MutationObserver(resolveTarget);
      observer.observe(document.body, { childList: true, subtree: true });
    }

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
      .select("id,title,body,read_at,created_at,lead_id,source")
      .eq("agency_id", agencyId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error) setRows((data || []) as NotificationRow[]);
  }

  useEffect(() => {
    if (!agencyId || !userId) return;
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    const onVisibility = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [agencyId, userId]);

  async function markRead(id: string) {
    if (!supabaseBrowser || !agencyId || !userId) return;
    const now = new Date().toISOString();
    const { error } = await supabaseBrowser
      .from("app_notifications")
      .update({ read_at: now })
      .eq("id", id)
      .eq("agency_id", agencyId)
      .eq("user_id", userId)
      .is("read_at", null);
    if (!error) setRows((current) => current.map((row) => row.id === id ? { ...row, read_at: row.read_at || now } : row));
  }

  async function markAllRead() {
    if (!supabaseBrowser || !agencyId || !userId || !unread) return;
    const now = new Date().toISOString();
    const { error } = await supabaseBrowser
      .from("app_notifications")
      .update({ read_at: now })
      .eq("agency_id", agencyId)
      .eq("user_id", userId)
      .is("read_at", null);
    if (!error) setRows((current) => current.map((row) => ({ ...row, read_at: row.read_at || now })));
  }

  if (!ready || !target || !agencyId || !userId) return null;

  return createPortal(
    <div className={`webNotificationBellWrap${open ? " open" : ""}`}>
      <button className="webNotificationBell" type="button" aria-label={unread ? `${unread} notificações não lidas` : "Notificações"} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) void load(); }}>
        <span aria-hidden="true">♢</span>
        {unread > 0 ? <b>{unread > 99 ? "99+" : unread}</b> : null}
      </button>
      {open ? <div className="webNotificationPanel" role="dialog" aria-label="Notificações">
        <div className="webNotificationHead"><div><strong>Notificações</strong><small>{unread ? `${unread} não lida(s)` : "Tudo em dia"}</small></div>{unread ? <button type="button" onClick={() => void markAllRead()}>Marcar todas como lidas</button> : null}</div>
        <div className="webNotificationList">
          {rows.length ? rows.map((row) => <button key={row.id} type="button" className={`webNotificationItem${row.read_at ? " read" : " unread"}`} onClick={() => void markRead(row.id)}>
            <span className="webNotificationDot" aria-hidden="true"></span>
            <span><strong>{row.title}</strong>{row.body ? <small>{row.body}</small> : null}<em>{timeLabel(row.created_at)}</em></span>
          </button>) : <div className="webNotificationEmpty">Nenhuma notificação.</div>}
        </div>
      </div> : null}
    </div>,
    target,
  );
}
