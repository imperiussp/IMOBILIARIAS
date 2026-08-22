"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Metrics={agencies:number;pendingDomains:number;pendingInvites:number;overdueFollowups:number;unorganizedAssets:number;billingFailures:number};
const empty:Metrics={agencies:0,pendingDomains:0,pendingInvites:0,overdueFollowups:0,unorganizedAssets:0,billingFailures:0};

export default function PlatformOperationsDashboard(){
  const [metrics,setMetrics]=useState<Metrics>(empty); const [message,setMessage]=useState("");
  useEffect(()=>{void(async()=>{ if(!supabaseBrowser)return; const now=new Date().toISOString(); const queries=await Promise.all([
    supabaseBrowser.from("agencies").select("id",{count:"exact",head:true}).in("status",["trial","active","past_due"]),
    supabaseBrowser.from("agency_domains").select("id",{count:"exact",head:true}).eq("verified",false),
    supabaseBrowser.from("agency_invitations").select("id",{count:"exact",head:true}).eq("status","pending"),
    supabaseBrowser.from("lead_followups").select("id",{count:"exact",head:true}).is("completed_at",null).lt("due_at",now),
    supabaseBrowser.from("agency_assets").select("id,agency_id,property_id,kind,storage_path").limit(500),
    supabaseBrowser.from("billing_events").select("id",{count:"exact",head:true}).eq("processing_status","failed"),
  ]);
  const hardError=queries.find(q=>q.error&&!["42P01","42703"].includes(q.error.code||"")); if(hardError?.error) setMessage(hardError.error.message);
  const assets=(queries[4].data||[]) as {agency_id:string;property_id:string|null;kind:string;storage_path:string}[];
  const unorganized=assets.filter(a=>!a.storage_path.startsWith(`${a.agency_id}/`)||(a.kind==="property_photo"&&a.property_id&&!a.storage_path.startsWith(`${a.agency_id}/${a.property_id}/photos/`))).length;
  setMetrics({agencies:queries[0].count||0,pendingDomains:queries[1].count||0,pendingInvites:queries[2].count||0,overdueFollowups:queries[3].count||0,unorganizedAssets:unorganized,billingFailures:queries[5].count||0});
  })();},[]);
  return <div className="adminPanel" id="saude-operacional"><div className="adminPanelHeader"><div><span className="eyebrow">OPERAÇÃO</span><h2>Saúde da plataforma</h2><p>Pontos que merecem atenção antes de afetar clientes.</p></div></div><div className="adminMetrics planMetrics"><article><span>Imobiliárias em operação</span><strong>{metrics.agencies}</strong></article><article><span>Domínios pendentes</span><strong>{metrics.pendingDomains}</strong></article><article><span>Convites pendentes</span><strong>{metrics.pendingInvites}</strong></article><article><span>Follow-ups atrasados</span><strong>{metrics.overdueFollowups}</strong></article><article><span>Arquivos fora do padrão</span><strong>{metrics.unorganizedAssets}</strong><small>amostra dos 500 mais recentes</small></article><article><span>Falhas financeiras</span><strong>{metrics.billingFailures}</strong></article></div>{message?<div className="formMessage">{message}</div>:null}</div>;
}
