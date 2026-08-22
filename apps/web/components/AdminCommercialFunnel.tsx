"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Funnel={total_leads:number;new_leads:number;contacted_leads:number;visits_scheduled:number;won_leads:number;lost_leads:number;leads_last_7d:number;leads_this_month:number;close_rate_percent:number;visit_rate_percent:number};
type Source={source:string;total:number;won:number;lost:number;close_rate_percent:number};
const empty:Funnel={total_leads:0,new_leads:0,contacted_leads:0,visits_scheduled:0,won_leads:0,lost_leads:0,leads_last_7d:0,leads_this_month:0,close_rate_percent:0,visit_rate_percent:0};

export default function AdminCommercialFunnel(){
  const [funnel,setFunnel]=useState<Funnel>(empty); const [sources,setSources]=useState<Source[]>([]); const [message,setMessage]=useState("");
  useEffect(()=>{void(async()=>{ if(!supabaseBrowser||!isSupabaseConfigured)return; const agency=await getCurrentAgency(); if(!agency)return setMessage("Imobiliária ativa não encontrada."); const [funnelResult,sourceResult]=await Promise.all([
    supabaseBrowser.from("agency_commercial_funnel").select("total_leads,new_leads,contacted_leads,visits_scheduled,won_leads,lost_leads,leads_last_7d,leads_this_month,close_rate_percent,visit_rate_percent").eq("agency_id",agency.agencyId).maybeSingle(),
    supabaseBrowser.from("agency_lead_source_performance").select("source,total,won,lost,close_rate_percent").eq("agency_id",agency.agencyId).order("total",{ascending:false}).limit(8),
  ]); if(funnelResult.error&&!['42P01','42703'].includes(funnelResult.error.code||''))return setMessage(funnelResult.error.message); if(sourceResult.error&&!['42P01','42703'].includes(sourceResult.error.code||''))return setMessage(sourceResult.error.message); if(funnelResult.data)setFunnel(funnelResult.data as Funnel); setSources((sourceResult.data||[]) as Source[]); })();},[]);
  return <div className="adminPanel" id="funil-comercial"><div className="adminPanelHeader"><div><span className="eyebrow">DESEMPENHO</span><h2>Funil comercial</h2><p>Acompanhe entrada de contatos, visitas e fechamentos da imobiliária ativa.</p></div><span>{isSupabaseConfigured?`${funnel.leads_this_month} no mês`:"Modo demonstração"}</span></div>
  <div className="adminMetrics planMetrics"><article><span>Novos</span><strong>{funnel.new_leads}</strong><small>{funnel.leads_last_7d} nos últimos 7 dias</small></article><article><span>Contatados</span><strong>{funnel.contacted_leads}</strong><small>em atendimento</small></article><article><span>Visitas</span><strong>{funnel.visits_scheduled}</strong><small>{Number(funnel.visit_rate_percent||0).toLocaleString('pt-BR')}% dos contatos</small></article><article><span>Fechados</span><strong>{funnel.won_leads}</strong><small>{Number(funnel.close_rate_percent||0).toLocaleString('pt-BR')}% de conversão concluída</small></article></div>
  {sources.length?<div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Origem</th><th>Contatos</th><th>Fechados</th><th>Perdidos</th><th>Conversão</th></tr></thead><tbody>{sources.map(row=><tr key={row.source}><td><strong>{row.source}</strong></td><td>{row.total}</td><td>{row.won}</td><td>{row.lost}</td><td>{Number(row.close_rate_percent||0).toLocaleString('pt-BR')}%</td></tr>)}</tbody></table></div>:null}
  {message?<div className="formMessage">{message}</div>:null}</div>;
}
