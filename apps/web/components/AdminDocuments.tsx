"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Template = { id: string; name: string; category: string; description: string | null };
type DocumentRow = { id: string; title: string; category: string; content: string | null; status: "draft" | "final" | "archived"; created_at: string; updated_at: string };

const statusLabel = { draft: "Rascunho", final: "Final", archived: "Arquivado" } as const;

export default function AdminDocuments() {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabaseBrowser) return;
    setLoading(true); setMessage("");
    const agency = await getCurrentAgency();
    if (!agency) { setLoading(false); return setMessage("Não foi possível identificar a imobiliária ativa."); }
    setAgencyId(agency.agencyId); setAgencyName(agency.agencyName);

    const permission = await supabaseBrowser.rpc("agency_can_use_documents", { p_agency_id: agency.agencyId });
    if (permission.error && permission.error.code !== "42883") { setLoading(false); return setMessage(permission.error.message); }
    const allowed = permission.error?.code === "42883" ? false : permission.data === true;
    setEnabled(allowed);
    if (!allowed) { setTemplates([]); setDocuments([]); setLoading(false); return; }

    const [templateResult, documentResult] = await Promise.all([
      supabaseBrowser.from("document_templates").select("id,name,category,description").eq("active", true).order("display_order").order("name"),
      supabaseBrowser.from("agency_documents").select("id,title,category,content,status,created_at,updated_at").eq("agency_id", agency.agencyId).order("updated_at", { ascending: false }).limit(30),
    ]);
    setLoading(false);
    if (templateResult.error) return setMessage(templateResult.error.message);
    if (documentResult.error) return setMessage(documentResult.error.message);
    const t = (templateResult.data || []) as Template[];
    setTemplates(t); setDocuments((documentResult.data || []) as DocumentRow[]);
    if (!selectedTemplate && t[0]) setSelectedTemplate(t[0].id);
  }

  useEffect(() => { void load(); }, []);

  async function createDocument() {
    if (!supabaseBrowser || !agencyId || !selectedTemplate) return;
    setSaving(true); setMessage("");
    const result = await supabaseBrowser.rpc("create_agency_document_from_template", {
      p_agency_id: agencyId,
      p_template_id: selectedTemplate,
      p_title: null,
      p_property_id: null,
      p_lead_id: null,
    });
    setSaving(false);
    if (result.error) return setMessage(result.error.message);
    setMessage("Documento criado como rascunho. Revise os campos antes de usar.");
    await load();
  }

  async function saveDocument() {
    if (!supabaseBrowser || !editing || !agencyId) return;
    setSaving(true); setMessage("");
    const result = await supabaseBrowser.from("agency_documents").update({
      title: editing.title.trim(), content: editing.content || "", status: editing.status, updated_at: new Date().toISOString(),
    }).eq("id", editing.id).eq("agency_id", agencyId);
    setSaving(false);
    if (result.error) return setMessage(result.error.message);
    setMessage("Documento salvo."); setEditing(null); await load();
  }

  return <div className="adminPanel" id="documentos">
    <div className="adminPanelHeader"><div><span className="eyebrow">DOCUMENTOS</span><h2>Central de documentos</h2><p>Modelos padronizados da imobiliária, liberados somente nos planos que incluírem este recurso.</p></div><span>{loading ? "Carregando..." : enabled ? `${documents.length} documento(s)` : "Recurso do plano"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">A central real ficará disponível no Supabase exclusivo do IMOBILIARIAS.</div> : null}
    {!loading && !enabled ? <div className="formNotice"><strong>Não incluído no plano atual.</strong> A administração da LENOY pode liberar “Central de documentos” por plano.</div> : null}
    {enabled ? <>
      <div className="domainPrimaryCard"><div><span className="eyebrow">NOVO DOCUMENTO</span><strong>{agencyName || "Imobiliária"}</strong><small>Escolha um modelo padrão. O sistema cria uma cópia editável e preserva o modelo original.</small></div><div className="accessActions"><select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select><button className="button primary" type="button" disabled={saving || !selectedTemplate} onClick={() => void createDocument()}>{saving ? "Criando..." : "Usar modelo"}</button></div></div>
      <div className="formNotice">Os modelos são uma base operacional editável. Antes do uso definitivo, a imobiliária deve revisar cláusulas, dados e adequação jurídica ao negócio e à legislação aplicável.</div>
      <div className="accessList">{templates.map((t) => <article className="accessRow" key={t.id}><div className="accessIdentity"><strong>{t.name}</strong><span>{t.category}</span><small>{t.description || "Modelo padrão"}</small></div></article>)}</div>
      <div className="accessList">{documents.map((doc) => <article className="accessRow" key={doc.id}><div className="accessIdentity"><strong>{doc.title}</strong><span>{doc.category} · {statusLabel[doc.status]}</span><small>Atualizado em {new Date(doc.updated_at).toLocaleString("pt-BR")}</small></div><div className="accessActions"><button className="miniButton" onClick={() => setEditing({ ...doc })}>Editar</button></div></article>)}</div>
    </> : null}
    {editing ? <div className="propertyForm"><div className="formGrid"><label>Título<input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label><label>Status<select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as DocumentRow["status"] })}><option value="draft">Rascunho</option><option value="final">Final</option><option value="archived">Arquivado</option></select></label></div><label>Conteúdo<textarea rows={18} value={editing.content || ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></label><div className="formActions"><button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="button primary" type="button" disabled={saving} onClick={() => void saveDocument()}>{saving ? "Salvando..." : "Salvar documento"}</button></div></div> : null}
    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
