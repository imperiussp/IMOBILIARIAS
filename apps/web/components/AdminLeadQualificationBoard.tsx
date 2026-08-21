"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Qualification = "unclassified" | "potential_buyer" | "follow_up" | "price_only" | "no_current_interest" | "other";
type Lead = { id: string; name: string | null; phone: string | null; email: string | null; qualification: Qualification; status: string; created_at: string; property_id: string | null };
type History = { id: string; lead_id: string; previous_qualification: Qualification | null; qualification: Qualification; changed_at: string };

const labels: Record<Qualification, string> = {
  unclassified: "Não classificado",
  potential_buyer: "Possível comprador",
  follow_up: "Acompanhar",
  price_only: "Só consultou preço",
  no_current_interest: "Sem interesse agora",
  other: "Outro",
};

export default function AdminLeadQualificationBoard() {
  const [agencyId, setAgencyId] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [filter, setFilter] = useState<Qualification | "">("");
  const [message, setMessage] = useState("");
  const [selectedLead, setSelectedLead] = useState("");

  async function load() {
    if (!supabaseBrowser || !isSupabaseConfigured) return;
    const current = await getCurrentAgency();
    if (!current) return setMessage("Não foi possível identificar a imobiliária ativa.");
    setAgencyId(current.agencyId);
    const [leadResult, historyResult] = await Promise.all([
      supabaseBrowser.from("leads").select("id,name,phone,email,qualification,status,created_at,property_id").eq("agency_id", current.agencyId).order("created_at", { ascending: false }).limit(150),
      supabaseBrowser.from("lead_qualification_history").select("id,lead_id,previous_qualification,qualification,changed_at").eq("agency_id", current.agencyId).order("changed_at", { ascending: false }).limit(300),
    ]);
    const error = leadResult.error || historyResult.error;
    if (error) return setMessage(error.message);
    setLeads((leadResult.data || []) as Lead[]);
    setHistory((historyResult.data || []) as History[]);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => filter ? leads.filter((lead) => lead.qualification === filter) : leads, [leads, filter]);
  const counts = useMemo(() => Object.keys(labels).reduce((acc, key) => ({ ...acc, [key]: leads.filter((lead) => lead.qualification === key).length }), {} as Record<Qualification, number>), [leads]);
  const selectedHistory = useMemo(() => history.filter((item) => item.lead_id === selectedLead).slice(0, 12), [history, selectedLead]);

  async function changeQualification(lead: Lead, qualification: Qualification) {
    if (!supabaseBrowser || !agencyId || qualification === lead.qualification) return;
    const { error } = await supabaseBrowser.from("leads").update({ qualification }).eq("id", lead.id).eq("agency_id", agencyId);
    if (error) return setMessage(error.message);
    setMessage(`${lead.name || "Contato"} classificado como ${labels[qualification]}.`);
    setSelectedLead(lead.id);
    await load();
  }

  return <div className="adminPanel" id="qualificacao-contatos">
    <div className="adminPanelHeader"><div><span className="eyebrow">CARTEIRA COMERCIAL</span><h2>Classificação dos contatos</h2><p>Separe intenção comercial do estágio do atendimento e preserve o histórico de cada mudança.</p></div><span>{isSupabaseConfigured ? `${leads.length} contato(s)` : "Modo demonstração"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">A classificação real ficará ativa quando o Supabase de produção estiver conectado.</div> : null}
    {message ? <div className="formMessage">{message}</div> : null}
    {isSupabaseConfigured ? <>
      <div className="adminMetrics planMetrics">{(Object.entries(labels) as [Qualification,string][]).slice(1,5).map(([key,label]) => <article key={key}><span>{label}</span><strong>{counts[key] || 0}</strong><small>contatos nesta classificação</small></article>)}</div>
      <div className="adminFilters"><select value={filter} onChange={(event) => setFilter(event.target.value as Qualification | "")}><option value="">Todas as classificações</option>{(Object.entries(labels) as [Qualification,string][]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><button className="miniButton" type="button" onClick={() => setFilter("")}>Limpar</button></div>
      <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Contato</th><th>Data</th><th>Classificação</th><th>Histórico</th></tr></thead><tbody>{filtered.map((lead) => <tr key={lead.id}><td><strong>{lead.name || "Contato sem nome"}</strong><small className="tableSub">{lead.phone || lead.email || "sem contato informado"}</small></td><td>{new Date(lead.created_at).toLocaleDateString("pt-BR")}</td><td><select value={lead.qualification} onChange={(event) => void changeQualification(lead, event.target.value as Qualification)}>{(Object.entries(labels) as [Qualification,string][]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><button className="miniButton" type="button" onClick={() => setSelectedLead(selectedLead === lead.id ? "" : lead.id)}>{selectedLead === lead.id ? "Fechar" : "Ver mudanças"}</button></td></tr>)}{!filtered.length ? <tr><td colSpan={4}>Nenhum contato nesta classificação.</td></tr> : null}</tbody></table></div>
      {selectedLead ? <div className="domainPrimaryCard"><div><span className="eyebrow">HISTÓRICO DA CLASSIFICAÇÃO</span>{selectedHistory.length ? selectedHistory.map((item) => <p key={item.id}><strong>{labels[item.qualification]}</strong> <small>· {new Date(item.changed_at).toLocaleString("pt-BR")}{item.previous_qualification ? ` · antes: ${labels[item.previous_qualification]}` : ""}</small></p>) : <p>Não há mudanças anteriores registradas para este contato.</p>}</div></div> : null}
    </> : null}
  </div>;
}
