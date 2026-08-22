"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Metrics={agencies:number;pendingDomains:number;pendingInvites:number;overdueFollowups:number;unorganizedAssets:number;billingFailures:number;maintenanceFailures:number;pendingProviderEvents:number;staleProviderEvents:number;abandonedProviderEvents:number;lastMaintenance:string|null};
const empty:Metrics={agencies:0,pendingDomains:0,pendingInvites:0,overdueFollowups:0,unorganizedAssets:0,billingFailures:0,maintenanceFailures:0,pendingProviderEvents:0,staleProviderEvents:0,abandonedProviderEvents:0,lastMaintenance:null};

export default function PlatformOperationsDashboard(){
  const [metrics,setMetrics]=useState<Metrics>(empty); const [message,setMessage]=useState(""); const [loading,setLoading]=useState(true);
  useEffect(()=>{void(async()=>{ if(!supabaseBrowser){setLoading(false);return;} const now=new Date().toISOString(); const staleCutoff=new Date(Date.now()-30*60*1000).toISOString(); const queries=await Promise.all([
    supabaseBrowser.from("agencies").select("id",{count:"exact",head:true}).in("status",["trial","active","past_due"]),
    supabaseBrowser.from("agency_domains").select("id",{count:"exact",head:true}).eq("verified",false),
    supabaseBrowser.from("agency_invitations").select("id",{count:"exact",head:true}).eq("status","pending"),
    supabaseBrowser.from("lead_followups").select("id",{count:"exact",head:true}).is("completed_at",null).lt("due_at",now),
    supabaseBrowser.from("agency_assets").select("id,agency_id,property_id,kind,storage_path,created_at").order("created_at",{ascending:false}).limit(500),
    supabaseBrowser.from("billing_events").select("id",{count:"exact",head:true}).eq("processing_status","failed"),
    supabaseBrowser.from("platform_maintenance_runs").select("started_at,success,failed_tasks").order("started_at",{ascending:false}).limit(20),
    supabaseBrowser.from("outreach_provider_event_inbox").select("id",{count:"exact",head:true}).is("processed_at",null).is("abandoned_at",null),
    supabaseBrowser.from("outreach_provider_event_inbox").select("id",{count:"exact",head:true}).is("processed_at",null).is("abandoned_at",null).lt("received_at",staleCutoff),
    supabaseBrowser.from("outreach_provider_event_inbox").select("id",{count:"exact",head:true}).not("abandoned_at","is",null),
  ]);
  const hardErrors=queries.filter(q=>q.error&&!["42P01","42703"].includes(q.error.code||"")); if(hardErrors.length)setMessage(hardErrors.map(q=>q.error?.message).filter(Boolean).join(" · "));
  const assets=(queries[4].data||[]) as {agency_id:string;property_id:string|null;kind:string;storage_path:string}[];
  const unorganized=assets.filter(a=>!a.storage_path.startsWith(`${a.agency_id}/`)||(a.kind==="property_photo"&&a.property_id&&!a.storage_path.startsWith(`${a.agency_id}/${a.property_id}/photos/`))).length;
  const maintenance=(queries[6].data||[]) as {started_at:string;success:boolean;failed_tasks:number}[];
  setMetrics({
    agencies:queries[0].count||0,
    pendingDomains:queries[1].count||0,
    pendingInvites:queries[2].count||0,
    overdueFollowups:queries[3].count||0,
    unorganizedAssets:unorganized,
    billingFailures:queries[5].count||0,
    maintenanceFailures:maintenance.filter(x=>!x.success).length,
    pendingProviderEvents:queries[7].count||0,
    staleProviderEvents:queries[8].count||0,
    abandonedProviderEvents:queries[9].count||0,
    lastMaintenance:maintenance[0]?.started_at||null,
  });setLoading(false);
  })();},[]);
  const maintenanceAgeMs=metrics.lastMaintenance?Date.now()-new Date(metrics.lastMaintenance).getTime():null;
  const maintenanceStale=!loading&&(!metrics.lastMaintenance||(maintenanceAgeMs!==null&&maintenanceAgeMs>24*60*60*1000));
  const attention=metrics.pendingDomains+metrics.overdueFollowups+metrics.unorganizedAssets+metrics.billingFailures+metrics.maintenanceFailures+metrics.staleProviderEvents+(maintenanceStale?1:0);
  return <div className="adminPanel" id="saude-operacional"><div className="adminPanelHeader"><div><span className="eyebrow">OPERAÇÃO</span><h2>Saúde da plataforma</h2><p>Pontos que merecem atenção antes de afetar clientes.</p></div><span>{loading?"Atualizando...":attention?`${attention} ponto(s) de atenção`:"Tudo sob controle"}</span></div><div className="adminMetrics planMetrics"><article><span>Imobiliárias em operação</span><strong>{metrics.agencies}</strong></article><article><span>Domínios pendentes</span><strong>{metrics.pendingDomains}</strong></article><article><span>Convites pendentes</span><strong>{metrics.pendingInvites}</strong></article><article><span>Follow-ups atrasados</span><strong>{metrics.overdueFollowups}</strong></article><article><span>Arquivos fora do padrão</span><strong>{metrics.unorganizedAssets}</strong><small>500 arquivos mais recentes</small></article><article><span>Falhas financeiras</span><strong>{metrics.billingFailures}</strong></article><article><span>Eventos aguardando correlação</span><strong>{metrics.pendingProviderEvents}</strong><small>{metrics.staleProviderEvents} há mais de 30 min</small></article><article><span>Eventos preservados para auditoria</span><strong>{metrics.abandonedProviderEvents}</strong><small>não são apagados automaticamente</small></article><article><span>Manutenções com falha</span><strong>{metrics.maintenanceFailures}</strong><small>20 execuções mais recentes</small></article><article><span>Última manutenção</span><strong>{metrics.lastMaintenance?new Date(metrics.lastMaintenance).toLocaleDateString("pt-BR"):"—"}</strong><small>{maintenanceStale?metrics.lastMaintenance?"Sem execução há mais de 24h":"Sem histórico de execução":metrics.lastMaintenance?new Date(metrics.lastMaintenance).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"Sem histórico"}</small></article></div>{maintenanceStale?<div className="formMessage">A manutenção automática está sem execução recente. Verifique o cron antes de liberar a plataforma para produção.</div>:null}{message?<div className="formMessage">{message}</div>:null}</div>;
}
