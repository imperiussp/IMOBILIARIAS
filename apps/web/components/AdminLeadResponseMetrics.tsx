"use client";

import { useEffect,useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured,supabaseBrowser } from "../lib/supabaseBrowser";

type Metrics={total_leads:number;responded:number;waiting_response:number;waiting_over_24h:number;avg_first_response_minutes:number|null;responded_within_24h_percent:number|null};
type Waiting={id:string;name:string|null;phone:string|null;email:string|null;created_at:string;source:string};
const empty:Metrics={total_leads:0,responded:0,waiting_response:0,waiting_over_24h:0,avg_first_response_minutes:null,responded_within_24h_percent:null};

function formatMinutes(value:number|null){if(value==null)return "—"; if(value<60)return `${Math.round(value)} min`; const hours=Math.floor(value/60); const min=Math.round(value%60); return `${hours}h ${min}min`;}

export default function AdminLeadResponseMetrics(){
 const [metrics,setMetrics]=useState<Metrics>(empty); const [waiting,setWaiting]=useState<Waiting[]>([]); const [message,setMessage]=useState("");
 useEffect(()=>{void(async()=>{if(!supabaseBrowser||!isSupabaseConfigured)return; const agency=await getCurrentAgency(); if(!agency)return setMessage("Imobiliária ativa não encontrada."); const [m,w]=await Promise.all([
  supabaseBrowser.from("agency_lead_response_metrics").select("total_leads,responded,waiting_response,waiting_over_24h,avg_first_response_minutes,responded_within_24h_percent").eq("agency_id",agency.agencyId).maybeSingle(),
  supabaseBrowser.from("leads").select("id,name,phone,email,created_at,source").eq("agency_id",agency.agencyId).eq("status","new").is("first_response_at",null).order("created_at",{ascending:true}).limit(12)
 ]); if(m.error&&!['42P01','42703'].includes(m.error.code||''))setMessage(m.error.message); if(w.error&&!['42P01','42703'].includes(w.error.code||''))setMessage(w.error.message); if(m.data)setMetrics(m.data as Metrics); setWaiting((w.data||[]) as Waiting[]);})();},[]);
 return <div className="adminPanel" id="tempo-resposta"><div className="adminPanelHeader"><div><span className="eyebrow">ATENDIMENTO</span><h2>Tempo de resposta</h2><p>Veja quanto tempo a equipe leva para iniciar o atendimento e quais contatos ainda aguardam retorno.</p></div></div>
 <div className="adminMetrics planMetrics"><article><span>Média até 1ª resposta</span><strong>{formatMinutes(metrics.avg_first_response_minutes)}</strong></article><article><span>Respondidos em 24h</span><strong>{Number(metrics.responded_within_24h_percent||0).toLocaleString('pt-BR')}%</strong></article><article><span>Aguardando resposta</span><strong>{metrics.waiting_response}</strong></article><article><span>Há mais de 24h</span><strong>{metrics.waiting_over_24h}</strong></article></div>
 {waiting.length?<div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Contato aguardando</th><th>Origem</th><th>Entrada</th><th>Espera</th></tr></thead><tbody>{waiting.map(item=>{const mins=Math.max(0,Math.floor((Date.now()-new Date(item.created_at).getTime())/60000));return <tr key={item.id}><td><strong>{item.name||"Contato sem nome"}</strong><small className="tableSub">{item.phone||item.email||"sem contato"}</small></td><td>{item.source}</td><td>{new Date(item.created_at).toLocaleString('pt-BR')}</td><td>{formatMinutes(mins)}</td></tr>})}</tbody></table></div>:null}
 {message?<div className="formMessage">{message}</div>:null}</div>;
}
