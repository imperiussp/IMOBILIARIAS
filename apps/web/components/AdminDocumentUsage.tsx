"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Usage = { documents_enabled: boolean; max_documents: number | null; used_documents: number; max_uploads: number | null; used_uploads: number };

function text(used: number, max: number | null) {
  return max == null ? `${used} / ilimitado` : `${used} / ${max}`;
}

export default function AdminDocumentUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { void (async () => {
    if (!supabaseBrowser) return;
    const agency = await getCurrentAgency();
    if (!agency) return;
    const result = await supabaseBrowser.rpc("agency_document_usage_snapshot", { p_agency_id: agency.agencyId });
    if (result.error) {
      if (result.error.code !== "42883") setMessage(result.error.message);
      return;
    }
    const rows = Array.isArray(result.data) ? result.data : [];
    setUsage((rows[0] || null) as Usage | null);
  })(); }, []);

  if (!usage && !message) return null;
  return <div className="adminPanel" id="uso-documentos">
    <div className="adminPanelHeader"><div><span className="eyebrow">PLANO</span><h2>Uso da Central de documentos</h2></div><span>{usage?.documents_enabled ? "Liberado" : "Bloqueado"}</span></div>
    {usage ? <div className="adminMetrics planMetrics"><article><span>Documentos ativos</span><strong>{text(Number(usage.used_documents || 0), usage.max_documents)}</strong><small>Arquivados não ocupam o limite.</small></article><article><span>Anexos privados</span><strong>{text(Number(usage.used_uploads || 0), usage.max_uploads)}</strong><small>Arquivos registrados na pasta privada.</small></article></div> : null}
    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
