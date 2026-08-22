"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Lead = { id:string; name:string|null; phone:string|null; email:string|null; created_at:string };
type Activity = { id:string; lead_id:string; event_type:string; title:string; detail:Record<string,unknown>|null; created_at:string };
type Note = { id:string; lead_id:string; body:string; created_at:string };

const eventLabels:Record<string,string>={created:"Novo contato",status_changed:"Etapa alterada",qualification_changed:"Classificação alterada",note_added:"Nota",followup_created:"Acompanhamento",followup_completed:"Acompanhamento concluído"};

export default function AdminLeadTimeline(){
  const [agencyId,setAgencyId]=useState("");
  const [leads,setLeads]=useState<Lead[]>([]);
  const [activities,setActivities]=useState<Activity[]>([]);
  const [notes,setNotes]=useState<Note[]>([]);
  const [selectedLead,setSelectedLead]=useState("");
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const agency=await getCurrentAgency();
    if(!agency)return setMessage("Imobiliária ativa não encontrada.");
    setAgencyId(agency.agencyId);
    const [leadResult,activityResult,noteResult]=await Promise.all([
      supabaseBrowser.from("leads").select("id,name,phone,email,created_at").eq("agency_id",agency.agencyId).order("created_at",{ascending:false}).limit(150),
      supabaseBrowser.from("lead_activity_events").select("id,lead_id,event_type,title,detail,created_at").eq("agency_id",agency.agencyId).order("created_at",{ascending:false}).limit(500),
      supabaseBrowser.from("lead_notes").select("id,lead_id,body,created_at").eq("agency_id",agency.agencyId).order("created_at",{ascending:false}).limit(300),
    ]);
    const error=leadResult.error||activityResult.error||noteResult.error;
    if(error&&!["42P01","42703"].includes(error.code||""))return setMessage(error.message);
    const nextLeads=(leadResult.data||[]) as Lead[];
    setLeads(nextLeads); setActivities((activityResult.data||[]) as Activity[]); setNotes((noteResult.data||[]) as Note[]);
    if(!selectedLead&&nextLeads[0])setSelectedLead(nextLeads[0].id);
  }
  useEffect(()=>{void load();},[]);

  const selected=leads.find(l=>l.id===selectedLead);
  const timeline=useMemo(()=>activities.filter(a=>a.lead_id===selectedLead).slice(0,40),[activities,selectedLead]);
  const leadNotes=useMemo(()=>notes.filter(n=>n.lead_id===selectedLead).slice(0,20),[notes,selectedLead]);

  async function addNote(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); if(!supabaseBrowser||!agencyId||!selectedLead)return;
    const form=new FormData(event.currentTarget); const body=String(form.get("body")||"").trim();
    if(!body)return setMessage("Digite a observação interna.");
    setSaving(true); setMessage("");
    const result=await supabaseBrowser.from("lead_notes").insert({agency_id:agencyId,lead_id:selectedLead,body});
    setSaving(false); if(result.error)return setMessage(result.error.message);
    event.currentTarget.reset(); setMessage("Nota registrada no histórico do contato."); await load();
  }

  function detailText(activity:Activity){
    const d=activity.detail||{};
    if(activity.event_type==="status_changed")return `${String(d.from||"—")} → ${String(d.to||"—")}`;
    if(activity.event_type==="qualification_changed")return `${String(d.from||"—")} → ${String(d.to||"—")}`;
    if(activity.event_type==="followup_created")return `${String(d.title||"")} · ${d.due_at?new Date(String(d.due_at)).toLocaleString("pt-BR"):""}`;
    return "";
  }

  return <div className="adminPanel" id="historico-contato">
    <div className="adminPanelHeader"><div><span className="eyebrow">CRM 360°</span><h2>Histórico do contato</h2><p>Etapas, classificações, acompanhamentos e notas internas ficam numa única linha do tempo.</p></div><span>{activities.length} evento(s)</span></div>
    {!isSupabaseConfigured?<div className="formNotice">A linha do tempo real ficará ativa no Supabase exclusivo do IMOBILIARIAS.</div>:null}
    {isSupabaseConfigured?<><div className="adminFilters"><select value={selectedLead} onChange={e=>setSelectedLead(e.target.value)}><option value="">Selecione um contato</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name||l.phone||l.email||"Contato"}</option>)}</select></div>
      {selectedLead?<div className="grid2"><div><div className="domainPrimaryCard"><div><span className="eyebrow">CONTATO</span><strong>{selected?.name||"Contato sem nome"}</strong><small>{selected?.phone||selected?.email||"Sem telefone/e-mail"}</small></div></div><form className="propertyForm" onSubmit={addNote}><label>Nova observação interna<textarea name="body" rows={4} maxLength={4000} placeholder="Ex.: cliente pediu retorno depois das 18h" /></label><div className="formActions"><button className="button primary" disabled={saving}>{saving?"Salvando...":"Adicionar nota"}</button></div></form>{leadNotes.length?<div className="accessList"><strong>Notas recentes</strong>{leadNotes.map(n=><article className="accessRow" key={n.id}><div className="accessIdentity"><strong>Nota interna</strong><span>{new Date(n.created_at).toLocaleString("pt-BR")}</span><small>{n.body}</small></div></article>)}</div>:null}</div>
      <div className="accessList">{timeline.map(a=><article className="accessRow" key={a.id}><div className="accessIdentity"><strong>{eventLabels[a.event_type]||a.title}</strong><span>{new Date(a.created_at).toLocaleString("pt-BR")}</span><small>{detailText(a)||a.title}</small></div></article>)}{!timeline.length?<div className="emptyMini">Ainda não há eventos registrados para este contato.</div>:null}</div></div>:null}</>:null}
    {message?<div className="formMessage">{message}</div>:null}
  </div>;
}
