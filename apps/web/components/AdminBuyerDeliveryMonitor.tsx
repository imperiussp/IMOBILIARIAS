"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Attempt = {
  id:string;
  opportunity_id:string;
  status:string;
  channel:string;
  provider:string|null;
  attempted_at:string;
  sent_at:string|null;
  delivered_at:string|null;
  read_at:string|null;
  error_message:string|null;
  provider_message_id:string|null;
};

type Opportunity = {
  id:string;
  status:string;
  match_score:number;
  leads?:{name?:string|null}|null;
  properties?:{code?:string|null;title?:string|null}|null;
};

type ChannelHealth={
  channel:string;
  provider:string;
  attempts_30d:number;
  delivered_30d:number;
  read_30d:number;
  failed_30d:number;
  delivery_rate_30d:number|null;
  read_rate_30d:number|null;
  failure_rate_30d:number|null;
};

type DeliveryEvent={
  id:string;
  attempt_id:string;
  event_type:string;
  current_status:string;
  occurred_at:string;
  error_message:string|null;
};

const labels:Record<string,string>={prepared:"Preparada",sending:"Enviando",sent:"Enviada",delivered:"Entregue",read:"Lida",failed:"Falhou"};
const channels:Record<string,string>={whatsapp:"WhatsApp",email:"E-mail",sms:"SMS"};
const eventLabels:Record<string,string>={attempt_created:"Tentativa criada",provider_message_linked:"ID do provedor vinculado",status_sending:"Envio iniciado",status_sent:"Enviada",status_delivered:"Entregue",status_read:"Lida",status_failed:"Falha",status_cancelled:"Cancelada"};

function statusLabel(status:string,channel:string){if(status==="read"&&channel==="email")return"Aberta";return labels[status]||status;}
function eventLabel(eventType:string,channel:string){if(eventType==="status_read"&&channel==="email")return"Aberta";return eventLabels[eventType]||eventType;}

export default function AdminBuyerDeliveryMonitor(){
  const [rows,setRows]=useState<(Attempt & {opportunity?:Opportunity|null})[]>([]);
  const [health,setHealth]=useState<ChannelHealth[]>([]);
  const [events,setEvents]=useState<DeliveryEvent[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
  const [filter,setFilter]=useState("all");
  const [channelFilter,setChannelFilter]=useState("all");

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const agency=await getCurrentAgency();
    if(!agency)return setMessage("Imobiliária ativa não encontrada.");

    const [attempts,healthResult]=await Promise.all([
      supabaseBrowser.from("buyer_outreach_delivery_attempts")
        .select("id,opportunity_id,status,channel,provider,attempted_at,sent_at,delivered_at,read_at,error_message,provider_message_id")
        .eq("agency_id",agency.agencyId).order("attempted_at",{ascending:false}).limit(100),
      supabaseBrowser.from("agency_buyer_outreach_channel_health")
        .select("channel,provider,attempts_30d,delivered_30d,read_30d,failed_30d,delivery_rate_30d,read_rate_30d,failure_rate_30d")
        .eq("agency_id",agency.agencyId),
    ]);
    if(attempts.error){if(!['42P01','42703'].includes(attempts.error.code||''))setMessage(attempts.error.message);return;}
    if(!healthResult.error)setHealth((healthResult.data||[]) as ChannelHealth[]);

    const attemptRows=(attempts.data||[]) as Attempt[];
    const attemptIds=attemptRows.map(row=>row.id);
    if(attemptIds.length){
      const eventResult=await supabaseBrowser.from("buyer_outreach_delivery_events")
        .select("id,attempt_id,event_type,current_status,occurred_at,error_message")
        .in("attempt_id",attemptIds).order("occurred_at",{ascending:false}).limit(500);
      if(!eventResult.error)setEvents((eventResult.data||[]) as DeliveryEvent[]);
      else if(!['42P01','42703'].includes(eventResult.error.code||''))setMessage(eventResult.error.message);
    }else setEvents([]);

    const ids=[...new Set(attemptRows.map(row=>row.opportunity_id).filter(Boolean))];
    let opportunities:Opportunity[]=[];
    if(ids.length){
      const result=await supabaseBrowser.from("buyer_property_opportunities")
        .select("id,status,match_score,leads(name),properties(code,title)").in("id",ids);
      if(!result.error)opportunities=(result.data||[]) as unknown as Opportunity[];
    }
    const byId=new Map(opportunities.map(item=>[item.id,item]));
    setRows(attemptRows.map(item=>({...item,opportunity:byId.get(item.opportunity_id)||null})));
  }

  useEffect(()=>{void load();},[]);

  async function returnToReview(row:Attempt){
    if(!supabaseBrowser)return;
    setBusy(row.id); setMessage("");
    const {error}=await supabaseBrowser.from("buyer_property_opportunities")
      .update({status:"review",last_error:null,skip_reason:"Falha anterior recolocada em revisão manualmente.",updated_at:new Date().toISOString()})
      .eq("id",row.opportunity_id);
    setBusy("");
    if(error)return setMessage(error.message);
    setMessage("Oportunidade devolvida para revisão. Nenhuma mensagem foi reenviada automaticamente.");
    await load();
  }

  const eventsByAttempt=useMemo(()=>{
    const map=new Map<string,DeliveryEvent[]>();
    for(const event of events){const list=map.get(event.attempt_id)||[];list.push(event);map.set(event.attempt_id,list);}
    return map;
  },[events]);
  const visible=useMemo(()=>rows.filter(row=>(filter==="all"||row.status===filter)&&(channelFilter==="all"||row.channel===channelFilter)),[rows,filter,channelFilter]);
  const delivered=rows.filter(row=>row.status==="delivered"||row.status==="read").length;
  const read=rows.filter(row=>row.status==="read").length;
  const failed=rows.filter(row=>row.status==="failed").length;
  const stuck=rows.filter(row=>row.status==="sending"&&Date.now()-new Date(row.attempted_at).getTime()>10*60*1000).length;

  return <div className="adminPanel adminOnly" id="entregas-oportunidades">
    <div className="adminPanelHeader"><div><span className="eyebrow">MENSAGERIA</span><h2>Entrega das oportunidades</h2><p>Acompanhe o retorno técnico dos provedores sem precisar consultar logs.</p></div><span>{rows.length} tentativa(s)</span></div>
    <div className="statsGrid"><article><strong>{rows.length}</strong><span>tentativas recentes</span></article><article><strong>{delivered}</strong><span>entregues</span></article><article><strong>{read}</strong><span>lidas/abertas</span></article><article><strong>{failed}</strong><span>falhas</span></article><article><strong>{stuck}</strong><span>enviando há +10 min</span></article></div>
    {health.length?<div className="accessList">{health.map(item=><article className="accessRow" key={`${item.channel}-${item.provider}`}><div className="accessIdentity"><strong>{channels[item.channel]||item.channel}</strong><span>{Number(item.attempts_30d||0)} tentativa(s) nos últimos 30 dias · {item.provider}</span><small>{Number(item.delivered_30d||0)} entregues · {Number(item.read_30d||0)} {item.channel==="email"?"abertas":"lidas"} · {Number(item.failed_30d||0)} falhas</small></div><div className="accessActions"><span className="statusPill">{Number(item.delivery_rate_30d||0)}% entregues</span><span className="statusPill">{Number(item.read_rate_30d||0)}% {item.channel==="email"?"abertas":"lidas"}</span><span className={`statusPill ${Number(item.failure_rate_30d||0)>10?"muted":""}`}>{Number(item.failure_rate_30d||0)}% falhas</span></div></article>)}</div>:null}
    <div className="adminFilters"><label>Situação<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas</option><option value="sending">Enviando</option><option value="sent">Enviadas</option><option value="delivered">Entregues</option><option value="read">Lidas/abertas</option><option value="failed">Falhas</option></select></label><label>Canal<select value={channelFilter} onChange={e=>setChannelFilter(e.target.value)}><option value="all">Todos</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="sms">SMS</option></select></label></div>
    {message?<div className="formMessage">{message}</div>:null}
    <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Cliente</th><th>Imóvel</th><th>Canal</th><th>Status</th><th>Provedor</th><th>Histórico</th><th>Último evento</th><th>Ação</th></tr></thead><tbody>{visible.length?visible.map(row=>{
      const history=eventsByAttempt.get(row.id)||[];
      const latestEvent=history[0]||null;
      const last=latestEvent?.occurred_at||row.read_at||row.delivered_at||row.sent_at||row.attempted_at;
      const sendingMinutes=row.status==="sending"?Math.floor((Date.now()-new Date(row.attempted_at).getTime())/60000):0;
      return <tr key={row.id}><td><strong>{row.opportunity?.leads?.name||"Contato"}</strong></td><td><strong>{row.opportunity?.properties?.code||"—"}</strong><small className="tableSub">{row.opportunity?.properties?.title||""}</small></td><td>{channels[row.channel]||row.channel}</td><td><span className="statusPill">{statusLabel(row.status,row.channel)}</span>{row.status==="sending"&&sendingMinutes>=10?<small className="tableSub">Aguardando retorno há {sendingMinutes} min</small>:null}{row.error_message?<small className="tableSub">{row.error_message}</small>:null}</td><td>{row.provider||"—"}{row.provider_message_id?<small className="tableSub">ID registrado</small>:null}</td><td><strong>{history.length}</strong><small className="tableSub">evento(s) técnico(s)</small></td><td>{latestEvent?<><strong>{eventLabel(latestEvent.event_type,row.channel)}</strong><small className="tableSub">{new Date(last).toLocaleString("pt-BR")}</small>{latestEvent.error_message?<small className="tableSub">{latestEvent.error_message}</small>:null}</>:new Date(last).toLocaleString("pt-BR")}</td><td>{row.status==="failed"?<button type="button" className="miniButton" onClick={()=>void returnToReview(row)} disabled={busy===row.id}>{busy===row.id?"Atualizando...":"Revisar novamente"}</button>:<span>—</span>}</td></tr>
    }):<tr><td colSpan={8}>Nenhuma tentativa nesta combinação de filtros.</td></tr>}</tbody></table></div>
    <div className="formNotice"><strong>Segurança:</strong> o histórico técnico é imutável. No e-mail, “aberta” indica o evento técnico de abertura do provedor e não garante leitura humana. Tentativas em envio há mais de 20 minutos são marcadas como falha pela manutenção automática, sem reenvio. “Revisar novamente” apenas devolve a oportunidade para análise.</div>
  </div>;
}
