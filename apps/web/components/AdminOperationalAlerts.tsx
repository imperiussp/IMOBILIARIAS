"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type AlertState={overdueFollowups:number;failedMessages:number;visitsToday:number;weakListings:number};
const empty:AlertState={overdueFollowups:0,failedMessages:0,visitsToday:0,weakListings:0};

export default function AdminOperationalAlerts(){
  const [state,setState]=useState<AlertState>(empty);
  const [message,setMessage]=useState("");

  useEffect(()=>{void(async()=>{
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const agency=await getCurrentAgency();
    if(!agency)return setMessage("Imobiliária ativa não encontrada.");
    const now=new Date();
    const start=new Date(now); start.setHours(0,0,0,0);
    const end=new Date(start); end.setDate(end.getDate()+1);

    const [followups,failures,visits,quality]=await Promise.all([
      supabaseBrowser.from("lead_followups").select("id",{count:"exact",head:true}).eq("agency_id",agency.agencyId).is("completed_at",null).lt("due_at",now.toISOString()),
      supabaseBrowser.from("buyer_outreach_delivery_attempts").select("id",{count:"exact",head:true}).eq("agency_id",agency.agencyId).eq("status","failed"),
      supabaseBrowser.from("property_visit_appointments").select("id",{count:"exact",head:true}).eq("agency_id",agency.agencyId).eq("status","scheduled").gte("scheduled_at",start.toISOString()).lt("scheduled_at",end.toISOString()),
      supabaseBrowser.from("agency_property_quality").select("property_id",{count:"exact",head:true}).eq("agency_id",agency.agencyId).lt("quality_score",70),
    ]);

    const errors=[followups.error,failures.error,visits.error,quality.error].filter(Boolean).filter((e:any)=>!['42P01','42703'].includes(e?.code||''));
    if(errors.length)setMessage((errors[0] as any).message||"Não foi possível carregar todos os alertas.");
    setState({
      overdueFollowups:followups.count||0,
      failedMessages:failures.count||0,
      visitsToday:visits.count||0,
      weakListings:quality.count||0,
    });
  })();},[]);

  const total=state.overdueFollowups+state.failedMessages+state.weakListings;
  return <div className="adminPanel" id="alertas-operacionais">
    <div className="adminPanelHeader"><div><span className="eyebrow">HOJE</span><h2>Alertas operacionais</h2><p>O que merece atenção imediata na imobiliária ativa.</p></div><span>{total} ponto(s) de atenção</span></div>
    <div className="statsGrid">
      <article><strong>{state.overdueFollowups}</strong><span>retornos atrasados</span><a href="#acompanhamentos">Ver acompanhamentos</a></article>
      <article><strong>{state.failedMessages}</strong><span>falhas de mensageria</span><a href="#entregas-oportunidades">Ver entregas</a></article>
      <article><strong>{state.visitsToday}</strong><span>visitas hoje</span><a href="#agenda-visitas">Ver agenda</a></article>
      <article><strong>{state.weakListings}</strong><span>anúncios abaixo de 70%</span><a href="#qualidade-imoveis">Revisar anúncios</a></article>
    </div>
    {message?<div className="formMessage">{message}</div>:null}
  </div>;
}
