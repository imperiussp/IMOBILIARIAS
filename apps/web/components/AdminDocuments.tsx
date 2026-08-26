"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Template = { id: string; name: string; category: string; description: string | null };
type DocumentRow = { id: string; title: string; category: string; content: string | null; status: "draft" | "final" | "archived"; property_id?: string | null; lead_id?: string | null; created_at: string; updated_at: string };
type PropertyRef = { id: string; code: string; title: string };
type LeadRef = { id: string; name: string; email: string | null; phone: string | null };
type Version = { id: string; version_number: number; title: string; status: DocumentRow["status"]; content: string | null; created_at: string };

const statusLabel = { draft: "Rascunho", final: "Final", archived: "Arquivado" } as const;

function printDocument(doc: DocumentRow, agencyName: string) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;
  const safe = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(doc.title)}</title><style>body{font-family:Arial,sans-serif;max-width:820px;margin:40px auto;color:#111;line-height:1.5}header{border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:28px}h1{font-size:24px}pre{white-space:pre-wrap;font:16px/1.55 Arial,sans-serif}.meta{color:#666;font-size:12px;margin-top:36px}@media print{button{display:none}}</style></head><body><header><strong>${safe(agencyName)}</strong><h1>${safe(doc.title)}</h1></header><pre>${safe(doc.content || "")}</pre><div class="meta">Status: ${statusLabel[doc.status]} · Gerado pela Central de documentos</div><button onclick="window.print()">Imprimir / Salvar em PDF</button></body></html>`);
  popup.document.close();
}

export default function AdminDocuments() {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [properties, setProperties] = useState<PropertyRef[]>([]);
  const [leads, setLeads] = useState<LeadRef[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedLead, setSelectedLead] = useState("");
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
    const [templateResult, documentResult, propertyResult, leadResult] = await Promise.all([
      supabaseBrowser.from("document_templates").select("id,name,category,description").eq("active", true).order("display_order").order("name"),
      supabaseBrowser.from("agency_documents").select("id,title,category,content,status,property_id,lead_id,created_at,updated_at").eq("agency_id", agency.agencyId).order("updated_at", { ascending: false }).limit(100),
      supabaseBrowser.from("properties").select("id,code,title").eq("agency_id", agency.agencyId).order("updated_at", { ascending: false }).limit(100),
      supabaseBrowser.from("leads").select("id,name,email,phone").eq("agency_id", agency.agencyId).order("created_at", { ascending: false }).limit(100),
    ]);
    setLoading(false);
    const error = templateResult.error || documentResult.error || propertyResult.error || leadResult.error;
    if (error) return setMessage(error.message);
    const t = (templateResult.data || []) as Template[];
    setTemplates(t); setDocuments((documentResult.data || []) as DocumentRow[]);
    setProperties((propertyResult.data || []) as PropertyRef[]); setLeads((leadResult.data || []) as LeadRef[]);
    if (!selectedTemplate && t[0]) setSelectedTemplate(t[0].id);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => documents.filter((doc) => {
    if (statusFilter !== "all" && doc.status !== statusFilter) return false;
    const text = `${doc.title} ${doc.category}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [documents, query, statusFilter]);

  function linkedLabel(doc: DocumentRow) {
    const lead = leads.find((item) => item.id === doc.lead_id);
    const property = properties.find((item) => item.id === doc.property_id);
    return [lead ? `Cliente: ${lead.name}` : "", property ? `Imóvel: ${property.title}` : ""].filter(Boolean).join(" · ");
  }

  async function createDocument() {
    if (!supabaseBrowser || !agencyId || !selectedTemplate) return;
    setSaving(true); setMessage("");
    const result = await supabaseBrowser.rpc("create_agency_document_from_template", { p_agency_id: agencyId, p_template_id: selectedTemplate, p_title: null, p_property_id: selectedProperty || null, p_lead_id: selectedLead || null });
    setSaving(false);
    if (result.error) return setMessage(result.error.message);
    setMessage("Documento criado como rascunho e vinculado aos registros selecionados.");
    setSelectedProperty(""); setSelectedLead(""); await load();
  }

  async function saveDocument() {
    if (!supabaseBrowser || !editing || !agencyId) return;
    setSaving(true); setMessage("");
    const result = await supabaseBrowser.from("agency_documents").update({ title: editing.title.trim(), content: editing.content || "", status: editing.status, property_id: editing.property_id || null, lead_id: editing.lead_id || null, updated_at: new Date().toISOString() }).eq("id", editing.id).eq("agency_id", agencyId);
    setSaving(false);
    if (result.error) return setMessage(result.error.message);
    setMessage("Documento salvo e nova versão registrada."); setEditing(null); setVersions([]); await load();
  }

  async function openDocument(doc: DocumentRow) {
    setEditing({ ...doc }); setVersions([]);
    if (!supabaseBrowser || !agencyId) return;
    const result = await supabaseBrowser.from("agency_document_versions").select("id,version_number,title,status,content,created_at").eq("agency_id", agencyId).eq("document_id", doc.id).order("version_number", { ascending: false }).limit(20);
    if (!result.error) setVersions((result.data || []) as Version[]);
  }

  async function duplicate(doc: DocumentRow) {
    if (!supabaseBrowser || !agencyId) return;
    const result = await supabaseBrowser.from("agency_documents").insert({ agency_id: agencyId, title: `${doc.title} - cópia`, category: doc.category, content: doc.content, status: "draft", property_id: doc.property_id || null, lead_id: doc.lead_id || null });
    if (result.error) return setMessage(result.error.message);
    setMessage("Cópia criada como rascunho."); await load();
  }

  async function deleteDocument(doc: DocumentRow) {
    if (!supabaseBrowser || !agencyId) return;
    if (!window.confirm(`Excluir definitivamente “${doc.title}”?`)) return;
    setSaving(true); setMessage("");
    const result = await supabaseBrowser.from("agency_documents").delete().eq("id", doc.id).eq("agency_id", agencyId);
    setSaving(false);
    if (result.error) return setMessage(result.error.message);
    if (editing?.id === doc.id) { setEditing(null); setVersions([]); }
    setMessage("Documento excluído."); await load();
  }

  async function shareDocument(doc: DocumentRow) {
    const text = `${agencyName}\n\n${doc.title}\n\n${doc.content || ""}`.trim();
    try {
      if (navigator.share) {
        await navigator.share({ title: doc.title, text });
        setMessage("Documento enviado para o compartilhamento do aparelho.");
        return;
      }
      await navigator.clipboard.writeText(text);
      setMessage("Documento copiado. Agora você pode colar no WhatsApp, e-mail ou outro aplicativo.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Não foi possível abrir o compartilhamento. Use PDF ou copie o conteúdo.");
    }
  }

  async function restoreVersion(version: Version) {
    if (!editing) return;
    setEditing({ ...editing, title: version.title, content: version.content, status: "draft" });
    setMessage(`Versão ${version.version_number} carregada para edição. Salve para registrar uma nova versão.`);
  }

  return <div className="adminPanel" id="documentos">
    <div className="adminPanelHeader"><div><span className="eyebrow">DOCUMENTOS</span><h2>Central de documentos</h2><p>Modelos, documentos de imóveis e clientes, edição, versões, PDF e compartilhamento.</p></div><span>{loading ? "Carregando..." : enabled ? `${documents.length} documento(s)` : "Recurso do plano"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">A central real ficará disponível no Supabase exclusivo do IMOBILIARIAS.</div> : null}
    {!loading && !enabled ? <div className="formNotice"><strong>Não incluído no plano atual.</strong></div> : null}
    {enabled ? <>
      <div className="domainPrimaryCard"><div><span className="eyebrow">NOVO DOCUMENTO</span><strong>{agencyName || "Imobiliária"}</strong><small>Escolha o modelo e, se desejar, vincule ao imóvel e ao cliente.</small></div><div className="accessActions"><select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select><button className="button primary" type="button" disabled={saving || !selectedTemplate} onClick={() => void createDocument()}>{saving ? "Criando..." : "Usar modelo"}</button></div></div>
      <div className="formGrid"><label>Vincular ao imóvel<select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)}><option value="">Nenhum</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</select></label><label>Vincular ao cliente<select value={selectedLead} onChange={(e) => setSelectedLead(e.target.value)}><option value="">Nenhum</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.phone || l.email || "sem contato"}</option>)}</select></label></div>
      <div className="formGrid"><label>Buscar documento<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Título ou categoria" /></label><label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Todos</option><option value="draft">Rascunhos</option><option value="final">Finais</option><option value="archived">Arquivados</option></select></label></div>
      <div className="accessList">{filtered.map((doc) => <article className="accessRow" key={doc.id}><div className="accessIdentity"><strong>{doc.title}</strong><span>{doc.category} · {statusLabel[doc.status]}</span>{linkedLabel(doc) ? <small>{linkedLabel(doc)}</small> : null}<small>Atualizado em {new Date(doc.updated_at).toLocaleString("pt-BR")}</small></div><div className="accessActions"><button className="miniButton" onClick={() => void openDocument(doc)}>Editar</button><button className="miniButton" onClick={() => printDocument(doc, agencyName)}>PDF</button><button className="miniButton" onClick={() => void shareDocument(doc)}>Compartilhar / reenviar</button><button className="miniButton muted" onClick={() => void duplicate(doc)}>Duplicar</button><button className="miniButton danger" onClick={() => void deleteDocument(doc)}>Excluir</button></div></article>)}</div>
    </> : null}
    {editing ? <div className="propertyForm"><div className="adminPanelHeader"><div><span className="eyebrow">EDIÇÃO</span><h3>{editing.title}</h3></div><div className="accessActions"><button className="miniButton" type="button" onClick={() => printDocument(editing, agencyName)}>PDF</button><button className="miniButton" type="button" onClick={() => void shareDocument(editing)}>Compartilhar</button><button className="miniButton danger" type="button" onClick={() => void deleteDocument(editing)}>Excluir</button></div></div><div className="formGrid"><label>Título<input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label><label>Status<select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as DocumentRow["status"] })}><option value="draft">Rascunho</option><option value="final">Final</option><option value="archived">Arquivado</option></select></label></div><div className="formGrid"><label>Imóvel<select value={editing.property_id || ""} onChange={(e) => setEditing({ ...editing, property_id: e.target.value || null })}><option value="">Nenhum</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</select></label><label>Cliente<select value={editing.lead_id || ""} onChange={(e) => setEditing({ ...editing, lead_id: e.target.value || null })}><option value="">Nenhum</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div><label>Conteúdo<textarea rows={20} value={editing.content || ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></label><div className="formActions"><button className="button secondary" type="button" onClick={() => { setEditing(null); setVersions([]); }}>Cancelar</button><button className="button primary" type="button" disabled={saving} onClick={() => void saveDocument()}>{saving ? "Salvando..." : "Salvar documento"}</button></div>{versions.length ? <div className="accessList"><strong>Histórico de versões</strong>{versions.map((v) => <article className="accessRow" key={v.id}><div className="accessIdentity"><strong>Versão {v.version_number}</strong><span>{statusLabel[v.status]}</span><small>{new Date(v.created_at).toLocaleString("pt-BR")}</small></div><button className="miniButton" type="button" onClick={() => void restoreVersion(v)}>Restaurar para rascunho</button></article>)}</div> : null}</div> : null}
    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
