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

const labels:Record<string,string>={prepared:"Preparada",sending:"Enviando",sent:"Enviada",delivered:"Entregue",read:"Lida",failed:"Falhou"};
const channels:Record<string,string>={whatsapp:"WhatsApp",email:"E-mail",sms:"SMS"};

export default function AdminBuyerDeliveryMonitor(){
  const [rows,setRows]=useState<(Attempt & {opportunity?:Opportunity|null})[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
  const [filter,setFilter]=useState("all");

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const agency=await getCurrentAgency();
    if(!agency)return setMessage("Imobiliária ativa não encontrada.");

    const attempts=await supabaseBrowser.from("buyer_outreach_delivery_attempts")
      .select("id,opportunity_id,status,channel,provider,attempted_at,sent_at,delivered_at,read_at,error_message,provider_message_id")
      .eq("agency_id",agency.agencyId).order("attempted_at",{ascending:false}).limit(100);
    if(attempts.error){if(!['42P01','42703'].includes(attempts.error.code||''))setMessage(attempts.error.message);return;}

    const ids=[...new Set((attempts.data||[]).map((row:any)=>row.opportunity_id).filter(Boolean))];
    let opportunities:Opportunity[]=[];
    if(ids.length){
      const result=await supabaseBrowser.from("buyer_property_opportunities")
        .select("id,status,match_score,leads(name),properties(code,title)").in("id",ids);
      if(!result.error)opportunities=(result.data||[]) as unknown as Opportunity[];
    }
    const byId=new Map(opportunities.map(item=>[item.id,item]));
    setRows(((attempts.data||[]) as Attempt[]).map(item=>({...item,opportunity:byId.get(item.opportunity_id)||null})));
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

  const visible=useMemo(()=>filter==="all"?rows:rows.filter(row=>row.status===filter),[rows,filter]);
  const delivered=rows.filter(row=>row.status==="delivered"||row.status==="read").length;
  const read=rows.filter(row=>row.status==="read").length;
  const failed=rows.filter(row=>row.status==="failed").length;

  return <div className="adminPanel adminOnly" id="entregas-oportunidades">
    <div className="adminPanelHeader"><div><span className="eyebrow">MENSAGERIA</span><h2>Entrega das oportunidades</h2><p>Acompanhe o retorno técnico dos provedores sem precisar consultar logs.</p></div><span>{rows.length} tentativa(s)</span></div>
    <div className="statsGrid"><article><strong>{rows.length}</strong><span>tentativas recentes</span></article><article><strong>{delivered}</strong><span>entregues</span></article><article><strong>{read}</strong><span>lidas</span></article><article><strong>{failed}</strong><span>falhas</span></article></div>
    <div className="adminFilters"><label>Situação<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas</option><option value="sending">Enviando</option><option value="sent">Enviadas</option><option value="delivered">Entregues</option><option value="read">Lidas</option><option value="failed">Falhas</option></select></label></div>
    {message?<div className="formMessage">{message}</div>:null}
    <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Cliente</th><th>Imóvel</th><th>Canal</th><th>Status</th><th>Provedor</th><th>Último evento</th><th>Ação</th></tr></thead><tbody>{visible.length?visible.map(row=>{
      const last=row.read_at||row.delivered_at||row.sent_at||row.attempted_at;
      return <tr key={row.id}><td><strong>{row.opportunity?.leads?.name||"Contato"}</strong></td><td><strong>{row.opportunity?.properties?.code||"—"}</strong><small className="tableSub">{row.opportunity?.properties?.title||""}</small></td><td>{channels[row.channel]||row.channel}</td><td><span className="statusPill">{labels[row.status]||row.status}</span>{row.error_message?<small className="tableSub">{row.error_message}</small>:null}</td><td>{row.provider||"—"}{row.provider_message_id?<small className="tableSub">ID registrado</small>:null}</td><td>{new Date(last).toLocaleString("pt-BR")}</td><td>{row.status==="failed"?<button type="button" className="miniButton" onClick={()=>void returnToReview(row)} disabled={busy===row.id}>{busy===row.id?"Atualizando...":"Revisar novamente"}</button>:<span>—</span>}</td></tr>
    }):<tr><td colSpan={7}>Nenhuma tentativa nesta situação.</td></tr>}</tbody></table></div>
    <div className="formNotice"><strong>Segurança:</strong> “Revisar novamente” apenas devolve a oportunidade para análise. Não dispara novo contato sozinho.</div>
  </div>;
}
