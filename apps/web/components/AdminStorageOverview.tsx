"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Health = { agency_id: string; kind: string; total_files: number; tenant_scoped_files: number; organized_files: number };
type Asset = { id: string; kind: string; bucket_id: string; storage_path: string; original_name: string | null; created_at: string };

const labels: Record<string, string> = {
  branding: "Identidade visual",
  property_photo: "Fotos de imóveis",
  property_document: "Documentos de imóveis",
  agency_document: "Documentos da imobiliária",
  broker_media: "Arquivos de corretores",
  other: "Outros",
};

export default function AdminStorageOverview() {
  const [agencyId, setAgencyId] = useState("");
  const [health, setHealth] = useState<Health[]>([]);
  const [recent, setRecent] = useState<Asset[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const agency = await getCurrentAgency();
    if (!agency) return setMessage("Imobiliária ativa não encontrada.");
    setAgencyId(agency.agencyId);
    const [healthResult, assetResult] = await Promise.all([
      supabaseBrowser.from("agency_asset_folder_health").select("agency_id,kind,total_files,tenant_scoped_files,organized_files").eq("agency_id", agency.agencyId),
      supabaseBrowser.from("agency_assets").select("id,kind,bucket_id,storage_path,original_name,created_at").eq("agency_id", agency.agencyId).order("created_at", { ascending: false }).limit(12),
    ]);
    if (healthResult.error && healthResult.error.code !== "42P01") return setMessage(healthResult.error.message);
    if (assetResult.error && assetResult.error.code !== "42P01") return setMessage(assetResult.error.message);
    setHealth((healthResult.data || []) as Health[]); setRecent((assetResult.data || []) as Asset[]);
  }

  useEffect(() => { void load(); }, []);

  return <div className="adminPanel adminOnly" id="arquivos">
    <div className="adminPanelHeader"><div><span className="eyebrow">ARQUIVOS</span><h2>Organização da imobiliária</h2><p>Inventário separado por imobiliária, imóvel, documentos e corretor. Novos uploads seguem pastas padronizadas.</p></div><span>{recent.length ? `${recent.length} recentes` : "Storage"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">Os dados reais de armazenamento aparecerão quando o Supabase exclusivo do IMOBILIARIAS estiver conectado.</div> : null}
    <div className="adminMetrics planMetrics">
      <article><span>Identidade visual</span><strong>branding/</strong><small>{agencyId || "agency_id"}/branding</small></article>
      <article><span>Fotos dos imóveis</span><strong>photos/</strong><small>{agencyId || "agency_id"}/property_id/photos</small></article>
      <article><span>Documentos</span><strong>documents/</strong><small>{agencyId || "agency_id"}/documents</small></article>
      <article><span>Corretores</span><strong>brokers/</strong><small>{agencyId || "agency_id"}/brokers/broker_id</small></article>
    </div>
    {health.length ? <div className="accessList">{health.map((row) => <article className="accessRow" key={row.kind}><div className="accessIdentity"><strong>{labels[row.kind] || row.kind}</strong><span>{Number(row.total_files).toLocaleString("pt-BR")} arquivo(s)</span><small>{Number(row.organized_files).toLocaleString("pt-BR")} no padrão novo · {Number(row.tenant_scoped_files).toLocaleString("pt-BR")} isolados pelo tenant</small></div><span className={`statusPill ${row.organized_files === row.total_files ? "" : "muted"}`}>{row.organized_files === row.total_files ? "Organizado" : "Legado detectado"}</span></article>)}</div> : null}
    {recent.length ? <div className="accessList"><strong>Arquivos recentes</strong>{recent.map((asset) => <article className="accessRow" key={asset.id}><div className="accessIdentity"><strong>{asset.original_name || labels[asset.kind] || asset.kind}</strong><span>{asset.bucket_id}</span><small>{asset.storage_path}</small></div></article>)}</div> : null}
    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
