"use client";

import { FormEvent, useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Lead = { id:string; name:string; phone:string|null; email:string|null };
type Followup = { id:string; lead_id:string; title:string; notes:string|null; due_at:string; completed_at:string|null; leads?: { name:string }|{ name:string }[]|null };

export default function AdminFollowups(){
  const [agencyId,setAgencyId]=useState("");
  const [leads,setLeads]=useState<Lead[]>([]);
  const [items,setItems]=useState<Followup[]>([]);
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);

  async function load(){
    if(!supabaseBrowser) return;
    const agency=await getCurrentAgency();
    if(!agency) return setMessage("Imobiliária ativa não encontrada.");
    setAgencyId(agency.agencyId);
    const [leadResult,followResult]=await Promise.all([
      supabaseBrowser.from("leads").select("id,name,phone,email").eq("agency_id",agency.agencyId).order("created_at",{ascending:false}).limit(100),
      supabaseBrowser.from("lead_followups").select("id,lead_id,title,notes,due_at,completed_at,leads(name)").eq("agency_id",agency.agencyId).order("completed_at",{ascending:true}).order("due_at",{ascending:true}).limit(100),
    ]);
    if(leadResult.error && leadResult.error.code!=="42P01") return setMessage(leadResult.error.message);
    if(followResult.error && followResult.error.code!=="42P01") return setMessage(followResult.error.message);
    setLeads((leadResult.data||[]) as Lead[]); setItems((followResult.data||[]) as Followup[]);
  }
  useEffect(()=>{void load();},[]);

  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); if(!supabaseBrowser||!agencyId) return;
    const form=new FormData(event.currentTarget); const leadId=String(form.get("lead_id")||""); const title=String(form.get("title")||"").trim(); const due=String(form.get("due_at")||"");
    if(!leadId||!title||!due) return setMessage("Informe contato, tarefa e data.");
    setSaving(true); setMessage("");
    const result=await supabaseBrowser.from("lead_followups").insert({agency_id:agencyId,lead_id:leadId,title,notes:String(form.get("notes")||"").trim()||null,due_at:new Date(due).toISOString()});
    setSaving(false); if(result.error) return setMessage(result.error.message); event.currentTarget.reset(); setMessage("Acompanhamento criado."); await load();
  }

  async function toggle(item:Followup){
    if(!supabaseBrowser||!agencyId) return;
    const result=await supabaseBrowser.from("lead_followups").update({completed_at:item.completed_at?null:new Date().toISOString()}).eq("id",item.id).eq("agency_id",agencyId);
    if(result.error) return setMessage(result.error.message); await load();
  }

  const pending=items.filter(i=>!i.completed_at); const overdue=pending.filter(i=>new Date(i.due_at).getTime()<Date.now());
  const leadName=(row:Followup)=>{ const value=row.leads; return Array.isArray(value)?value[0]?.name:value?.name; };

  return <div className="adminPanel" id="acompanhamentos">
    <div className="adminPanelHeader"><div><span className="eyebrow">CRM</span><h2>Acompanhamentos</h2><p>Organize retornos, visitas, propostas e próximas ações de cada contato.</p></div><span>{pending.length} pendente(s)</span></div>
    <div className="adminMetrics planMetrics"><article><span>Pendentes</span><strong>{pending.length}</strong></article><article><span>Atrasados</span><strong>{overdue.length}</strong></article><article><span>Concluídos</span><strong>{items.length-pending.length}</strong></article></div>
    <form className="propertyForm" onSubmit={create}><div className="formGrid"><label>Contato<select name="lead_id" required defaultValue=""><option value="">Selecione</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>Data e hora<input name="due_at" type="datetime-local" required /></label></div><label>Tarefa<input name="title" placeholder="Ex.: Retornar proposta" required /></label><label>Observações<textarea name="notes" rows={3} /></label><div className="formActions"><button className="button primary" disabled={saving}>{saving?"Salvando...":"Adicionar acompanhamento"}</button></div></form>
    <div className="accessList">{items.map(item=><article className="accessRow" key={item.id}><div className="accessIdentity"><strong>{item.title}</strong><span>{leadName(item)||"Contato"} · {new Date(item.due_at).toLocaleString("pt-BR")}</span><small>{item.notes||"Sem observações"}</small></div><div className="accessActions"><span className={`statusPill ${item.completed_at?"muted":""}`}>{item.completed_at?"Concluído":new Date(item.due_at).getTime()<Date.now()?"Atrasado":"Pendente"}</span><button className="miniButton" onClick={()=>void toggle(item)}>{item.completed_at?"Reabrir":"Concluir"}</button></div></article>)}</div>
    {message?<div className="formMessage">{message}</div>:null}
  </div>;
}
