"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Summary={available:number;reserved:number;rented:number;sold:number;inactive:number;drafts:number;published:number};
type History={id:string;property_id:string;previous_status:string|null;status:string;previous_publication_state:string|null;publication_state:string|null;changed_at:string;properties?:{code?:string;title?:string}|{code?:string;title?:string}[]|null};
const empty:Summary={available:0,reserved:0,rented:0,sold:0,inactive:0,drafts:0,published:0};
const labels:Record<string,string>={available:"Disponível",reserved:"Reservado",rented:"Alugado",sold:"Vendido",inactive:"Inativo",draft:"Rascunho",published:"Publicado"};

export default function AdminPropertyLifecycle(){
  const [summary,setSummary]=useState<Summary>(empty); const [history,setHistory]=useState<History[]>([]); const [message,setMessage]=useState("");
  useEffect(()=>{void(async()=>{ if(!supabaseBrowser||!isSupabaseConfigured)return; const agency=await getCurrentAgency(); if(!agency)return setMessage("Imobiliária ativa não encontrada."); const [summaryResult,historyResult]=await Promise.all([
    supabaseBrowser.from("agency_property_lifecycle_summary").select("available,reserved,rented,sold,inactive,drafts,published").eq("agency_id",agency.agencyId).maybeSingle(),
    supabaseBrowser.from("property_status_history").select("id,property_id,previous_status,status,previous_publication_state,publication_state,changed_at,properties(code,title)").eq("agency_id",agency.agencyId).order("changed_at",{ascending:false}).limit(30),
  ]); if(summaryResult.error&&!['42P01','42703'].includes(summaryResult.error.code||''))return setMessage(summaryResult.error.message); if(historyResult.error&&!['42P01','42703'].includes(historyResult.error.code||''))return setMessage(historyResult.error.message); if(summaryResult.data)setSummary(summaryResult.data as Summary); setHistory((historyResult.data||[]) as unknown as History[]); })();},[]);
  const property=(row:History)=>Array.isArray(row.properties)?row.properties[0]:row.properties;
  return <div className="adminPanel adminOnly" id="ciclo-imoveis"><div className="adminPanelHeader"><div><span className="eyebrow">CICLO DO IMÓVEL</span><h2>Disponibilidade e histórico</h2><p>Acompanhe imóveis disponíveis, reservados, alugados, vendidos e mudanças de publicação sem apagar o histórico comercial.</p></div><span>{isSupabaseConfigured?`${summary.published} publicado(s)`:"Modo demonstração"}</span></div>
  <div className="adminMetrics planMetrics"><article><span>Disponíveis</span><strong>{summary.available}</strong></article><article><span>Reservados</span><strong>{summary.reserved}</strong></article><article><span>Alugados</span><strong>{summary.rented}</strong></article><article><span>Vendidos</span><strong>{summary.sold}</strong></article></div>
  {history.length?<div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Imóvel</th><th>Alteração</th><th>Publicação</th><th>Data</th></tr></thead><tbody>{history.map(row=>{const item=property(row);return <tr key={row.id}><td><strong>{item?.code||"Imóvel"}</strong><small className="tableSub">{item?.title||""}</small></td><td>{row.previous_status?`${labels[row.previous_status]||row.previous_status} → `:""}<strong>{labels[row.status]||row.status}</strong></td><td>{row.previous_publication_state!==row.publication_state&&row.publication_state?`${row.previous_publication_state?`${labels[row.previous_publication_state]||row.previous_publication_state} → `:""}${labels[row.publication_state]||row.publication_state}`:"—"}</td><td>{new Date(row.changed_at).toLocaleString("pt-BR")}</td></tr>})}</tbody></table></div>:null}
  {message?<div className="formMessage">{message}</div>:null}</div>;
}
