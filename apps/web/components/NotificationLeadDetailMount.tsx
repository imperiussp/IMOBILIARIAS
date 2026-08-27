"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type LeadDetail = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  created_at: string;
};

export default function NotificationLeadDetailMount() {
  const [target, setTarget] = useState<Element | null>(null);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!supabaseBrowser || !window.location.pathname.includes("/app")) return;
    const params = new URLSearchParams(window.location.search);
    const leadId = params.get("lead") || "";
    if (!leadId || params.get("view") !== "contatos") return;

    let disposed = false;
    let observer: MutationObserver | null = null;

    const resolveTarget = () => {
      const next = document.querySelector(".mobileAppContent");
      if (next && !disposed) {
        setTarget(next);
        observer?.disconnect();
      }
    };
    resolveTarget();
    if (!document.querySelector(".mobileAppContent")) {
      observer = new MutationObserver(resolveTarget);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    void (async () => {
      const agency = await getCurrentAgency();
      if (!agency || disposed || !supabaseBrowser) return;
      const { data, error } = await supabaseBrowser
        .from("leads")
        .select("id,name,phone,email,message,source,status,created_at")
        .eq("id", leadId)
        .eq("agency_id", agency.agencyId)
        .maybeSingle();
      if (!disposed && !error && data) setLead(data as LeadDetail);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  function close() {
    setDismissed(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("lead");
    url.searchParams.delete("notification");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  if (!target || !lead || dismissed) return null;

  return createPortal(
    <section className="notificationLeadDetail" aria-label="Informações da notificação">
      <div className="notificationLeadDetailHead">
        <div><span>NOVA SOLICITAÇÃO</span><strong>{lead.name || "Contato sem nome"}</strong></div>
        <button type="button" onClick={close} aria-label="Fechar informações">×</button>
      </div>
      <div className="notificationLeadDetailBody">
        {lead.message ? <p>{lead.message}</p> : <p>Sem informações adicionais.</p>}
        <div>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : null}{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : null}</div>
      </div>
      <style>{`
        .notificationLeadDetail{margin:12px 16px 16px;padding:16px;border:2px solid var(--tenant-primary,#173a63);border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(15,35,60,.12);white-space:normal}
        .notificationLeadDetailHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
        .notificationLeadDetailHead div{display:grid;gap:4px}.notificationLeadDetailHead span{font-size:10px;font-weight:800;letter-spacing:.1em;color:var(--tenant-primary,#173a63)}
        .notificationLeadDetailHead strong{font-size:18px;color:#172033}.notificationLeadDetailHead button{width:34px;height:34px;border:0;border-radius:50%;background:#eef2f6;color:#172033;font-size:22px;line-height:1;cursor:pointer}
        .notificationLeadDetailBody p{margin:0;white-space:pre-line;line-height:1.55;color:#334155;font-size:14px}.notificationLeadDetailBody div{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
        .notificationLeadDetailBody a{display:inline-flex;padding:9px 12px;border-radius:10px;background:var(--tenant-primary,#173a63);color:#fff;text-decoration:none;font-size:12px;font-weight:700}
      `}</style>
    </section>,
    target,
  );
}
