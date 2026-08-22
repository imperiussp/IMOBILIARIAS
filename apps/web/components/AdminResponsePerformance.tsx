"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Metrics={total_leads:number;responded_leads:number;awaiting_response:number;avg_first_response_minutes:number;responded_within_24h_percent:number;unanswered_over_24h:number};
type Waiting={lead_id:string;name:string|null;phone:string|null;email:string|null;source:string|null;created_at:string;waiting_hours:number};
const empty:Metrics={total_leads:0,responded_leads:0,awaiting_response:0,avg_first_response_minutes:0,responded_within_24h_percent:0,unanswered_over_24h:0};

export default function AdminResponsePerformance(){
  const [metrics,setMetrics]=useState<Metrics>(empty); const [waiting,setWaiting]=useState<Waiting[]>([]); const [message,setMessage]=useState("");
  useEffect(()=>{void(async()=>{if(!supabaseBrowser||!isSupabaseConfigured)return; const agency=await getCurrentAgency(); if(!agency)return setMessage("Imobiliária ativa não encontrada."); const [metricResult,waitingResult]=await Promise.all([
    supabaseBrowser.from("agency_lead_response_performance").select("total_leads,responded_leads,awaiting_response,avg_first_response_minutes,responded_within_24h_percent,unanswered_over_24h").eq("agency_id",agency.agencyId).maybeSingle(),
    supabaseBrowser.from("agency_unanswered_leads").select("lead_id,name,phone,email,source,created_at,waiting_hours").eq("agency_id",agency.agencyId).order("created_at",{ascending:true}).limit(20),
  ]); if(metricResult.error&&!['42P01','42703'].includes(metricResult.error.code||''))return setMessage(metricResult.error.message); if(waitingResult.error&&!['42P01','42703'].includes(waitingResult.error.code||''))return setMessage(waitingResult.error.message); if(metricResult.data)setMetrics(metricResult.data as Metrics); setWaiting((waitingResult.data||[]) as Waiting[]);})();},[]);
  const formatMinutes=(value:number)=>{const minutes=Math.max(0,Number(value||0)); if(minutes<60)return `${Math.round(minutes)} min`; const hours=Math.floor(minutes/60); const rest=Math.round(minutes%60); return `${hours}h${rest?` ${rest}min`:""}`;};
  return <div className="adminPanel" id="tempo-resposta"><div className="adminPanelHeader"><div><span className="eyebrow">ATENDIMENTO</span><h2>Tempo de resposta</h2><p>Monitore quanto tempo os novos contatos levam para receber a primeira ação comercial.</p></div><span>{isSupabaseConfigured?`${metrics.awaiting_response} aguardando`:"Modo demonstração"}</span></div>
  <div className="adminMetrics planMetrics"><article><span>Tempo médio</span><strong>{formatMinutes(metrics.avg_first_response_minutes)}</strong><small>primeira resposta</small></article><article><span>Respondidos em 24h</span><strong>{Number(metrics.responded_within_24h_percent||0).toLocaleString("pt-BR")}%</strong><small>dos contatos recebidos</small></article><article><span>Aguardando</span><strong>{metrics.awaiting_response}</strong><small>ainda em Novo</small></article><article><span>Há mais de 24h</span><strong>{metrics.unanswered_over_24h}</strong><small>prioridade de retorno</small></article></div>
  {waiting.length?<div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Contato aguardando</th><th>Origem</th><th>Recebido</th><th>Espera</th></tr></thead><tbody>{waiting.map(row=><tr key={row.lead_id}><td><strong>{row.name||"Contato sem nome"}</strong><small className="tableSub">{row.phone||row.email||"sem contato informado"}</small></td><td>{row.source||"outro"}</td><td>{new Date(row.created_at).toLocaleString("pt-BR")}</td><td><span className={`statusPill ${Number(row.waiting_hours)>24?"":"muted"}`}>{Number(row.waiting_hours).toLocaleString("pt-BR",{maximumFractionDigits:1})}h</span></td></tr>)}</tbody></table></div>:null}
  {message?<div className="formMessage">{message}</div>:null}</div>;
}
