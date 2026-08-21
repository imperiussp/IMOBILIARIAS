"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { agencyUploadedDocumentPath } from "../lib/storagePaths";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Asset = { id: string; storage_path: string; original_name: string | null; mime_type: string | null; size_bytes: number | null; created_at: string };

function size(value: number | null) {
  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminDocumentUploads() {
  const [agencyId, setAgencyId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!supabaseBrowser) return;
    const agency = await getCurrentAgency();
    if (!agency) return setMessage("Imobiliária ativa não encontrada.");
    setAgencyId(agency.agencyId);
    const permission = await supabaseBrowser.rpc("agency_can_use_documents", { p_agency_id: agency.agencyId });
    if (permission.error) return setMessage(permission.error.message);
    setEnabled(permission.data === true);
    if (permission.data !== true) return setAssets([]);
    const result = await supabaseBrowser.from("agency_assets")
      .select("id,storage_path,original_name,mime_type,size_bytes,created_at")
      .eq("agency_id", agency.agencyId).eq("kind", "agency_document")
      .order("created_at", { ascending: false }).limit(50);
    if (result.error) return setMessage(result.error.message);
    setAssets((result.data || []) as Asset[]);
  }

  useEffect(() => { void load(); }, []);

  async function upload(files: FileList | null) {
    if (!supabaseBrowser || !agencyId || !enabled || !files?.length) return;
    const selected = Array.from(files).slice(0, 10);
    setBusy(true); setMessage("");
    for (const file of selected) {
      try {
        if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: limite de 15 MB por arquivo.`);
        const token = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${file.name}`;
        const path = agencyUploadedDocumentPath(agencyId, token);
        const stored = await supabaseBrowser.storage.from("agency-documents").upload(path, file, { upsert: false, contentType: file.type || undefined, cacheControl: "3600" });
        if (stored.error) throw stored.error;
        const registered = await supabaseBrowser.rpc("register_agency_asset", {
          p_agency_id: agencyId,
          p_kind: "agency_document",
          p_bucket_id: "agency-documents",
          p_storage_path: path,
          p_property_id: null,
          p_broker_id: null,
          p_document_id: null,
          p_original_name: file.name,
          p_mime_type: file.type || null,
          p_size_bytes: file.size,
        });
        if (registered.error) {
          await supabaseBrowser.storage.from("agency-documents").remove([path]);
          throw registered.error;
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
        setBusy(false); await load(); return;
      }
    }
    setBusy(false); setMessage(`${selected.length} arquivo(s) enviado(s) para a pasta privada da imobiliária.`); await load();
  }

  async function open(asset: Asset) {
    if (!supabaseBrowser) return;
    const signed = await supabaseBrowser.storage.from("agency-documents").createSignedUrl(asset.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl) return setMessage(signed.error?.message || "Não foi possível abrir o arquivo.");
    window.open(signed.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(asset: Asset) {
    if (!supabaseBrowser || !window.confirm(`Excluir ${asset.original_name || "este arquivo"}?`)) return;
    setBusy(true); setMessage("");
    const storage = await supabaseBrowser.storage.from("agency-documents").remove([asset.storage_path]);
    if (storage.error) { setBusy(false); return setMessage(storage.error.message); }
    const row = await supabaseBrowser.from("agency_assets").delete().eq("id", asset.id).eq("agency_id", agencyId);
    setBusy(false);
    if (row.error) return setMessage(row.error.message);
    setMessage("Arquivo excluído."); await load();
  }

  return <div className="adminPanel" id="arquivos-documentos">
    <div className="adminPanelHeader"><div><span className="eyebrow">ARQUIVOS PRIVADOS</span><h2>Documentos enviados</h2><p>PDFs e anexos ficam em pasta privada exclusiva da imobiliária e não são expostos no site público.</p></div><span>{assets.length} arquivo(s)</span></div>
    {!enabled ? <div className="formNotice">Uploads privados fazem parte da Central de documentos e dependem do plano.</div> : <>
      <label className="uploadBox">Enviar documentos<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx,.xls,.xlsx" multiple disabled={busy} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ""; }} /><span>{busy ? "Enviando..." : "Até 10 arquivos por vez, máximo de 15 MB cada. Pasta: documents/uploads."}</span></label>
      <div className="accessList">{assets.map((asset) => <article className="accessRow" key={asset.id}><div className="accessIdentity"><strong>{asset.original_name || "Arquivo"}</strong><span>{asset.mime_type || "arquivo"} · {size(asset.size_bytes)}</span><small>{asset.storage_path}</small></div><div className="accessActions"><button className="miniButton" onClick={() => void open(asset)}>Abrir</button><button className="miniButton danger" disabled={busy} onClick={() => void remove(asset)}>Excluir</button></div></article>)}</div>
    </>}
    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
