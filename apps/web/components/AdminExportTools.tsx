"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type ExportKind = "properties" | "leads" | "brokers";

function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) throw new Error("Não há registros para exportar.");
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [headers.map(escapeCsv).join(";"), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminExportTools() {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<ExportKind | "">("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const agency = await getCurrentAgency();
      if (!active) return;
      if (!agency) {
        setMessage("Não foi possível identificar a imobiliária ativa.");
        return;
      }
      setAgencyId(agency.agencyId);
      setAgencyName(agency.agencyName);
    })();
    return () => { active = false; };
  }, []);

  async function exportData(kind: ExportKind) {
    if (!supabaseBrowser) {
      setMessage("O Supabase do IMOBILIARIAS ainda não está configurado.");
      return;
    }
    if (!agencyId) {
      setMessage("Selecione uma imobiliária antes de exportar dados.");
      return;
    }
    setLoading(kind);
    setMessage("");
    try {
      if (kind === "properties") {
        const { data, error } = await supabaseBrowser.from("properties")
          .select("code,title,purpose,segment,zone,status,publication_state,price,bedrooms,suites,bathrooms,parking_spaces,built_area_m2,land_area_m2,address,address_public,featured,created_at,updated_at")
          .eq("agency_id", agencyId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        downloadCsv(`imoveis-${new Date().toISOString().slice(0,10)}.csv`, (data || []) as Record<string, unknown>[]);
      }
      if (kind === "leads") {
        const { data, error } = await supabaseBrowser.from("leads")
          .select("name,phone,email,message,source,status,notes,created_at,updated_at")
          .eq("agency_id", agencyId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        downloadCsv(`contatos-${new Date().toISOString().slice(0,10)}.csv`, (data || []) as Record<string, unknown>[]);
      }
      if (kind === "brokers") {
        const { data, error } = await supabaseBrowser.from("brokers")
          .select("name,phone,whatsapp,email,creci,area_of_operation,active,created_at,updated_at")
          .eq("agency_id", agencyId)
          .order("name");
        if (error) throw error;
        downloadCsv(`corretores-${new Date().toISOString().slice(0,10)}.csv`, (data || []) as Record<string, unknown>[]);
      }
      setMessage("Arquivo gerado com sucesso somente com os dados desta imobiliária.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="adminPanel" id="exportacoes">
      <div className="adminPanelHeader"><div><span className="eyebrow">CÓPIA DOS DADOS</span><h2>Exportações</h2><p>{agencyName ? `Gere arquivos CSV somente com os dados de ${agencyName}.` : "Gere cópias em CSV dos principais cadastros da imobiliária ativa."}</p></div></div>
      {!isSupabaseConfigured ? <div className="formNotice">Disponível quando o Supabase exclusivo do IMOBILIARIAS estiver conectado.</div> : null}
      <div className="exportActions">
        <button className="button secondary" disabled={Boolean(loading) || !agencyId} onClick={() => void exportData("properties")}>{loading === "properties" ? "Gerando..." : "Exportar imóveis"}</button>
        <button className="button secondary" disabled={Boolean(loading) || !agencyId} onClick={() => void exportData("leads")}>{loading === "leads" ? "Gerando..." : "Exportar contatos"}</button>
        <button className="button secondary" disabled={Boolean(loading) || !agencyId} onClick={() => void exportData("brokers")}>{loading === "brokers" ? "Gerando..." : "Exportar corretores"}</button>
      </div>
      {message ? <div className="formMessage exportMessage">{message}</div> : null}
    </div>
  );
}
