"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Row={id:string;response_kind:string;response_text:string|null;channel:string;received_at:string;leads?:{name?:string|null}|null;properties?:{code?:string|null;title?:string|null}|null};
const labels:Record<string,string>={reply:"Resposta",interested:"Interessado",not_interested:"Sem interesse",request_details:"Pediu detalhes",request_visit:"Pediu visita",opt_out:"Não quer receber",other:"Outro"};
const channels:Record<string,string>={whatsapp:"WhatsApp",email:"E-mail",sms:"SMS"};

export default function AdminBuyerOutreachResponses(){
  const [rows,setRows]=useState<Row[]>([]); const [message,setMessage]=useState(""); const [filter,setFilter]=useState("all");
  async function load(){if(!supabaseBrowser||!isSupabaseConfigured)return; const agency=await getCurrentAgency(); if(!agency)return setMessage("Imobiliária ativa não encontrada."); const {data,error}=await supabaseBrowser.from("buyer_outreach_responses").select("id,response_kind,response_text,channel,received_at,leads(name),properties(code,title)").eq("agency_id",agency.agencyId).order("received_at",{ascending:false}).limit(100); if(error){if(!['42P01','42703'].includes(error.code||''))setMessage(error.message);return;} setRows((data||[]) as unknown as Row[]);}
  useEffect(()=>{void load();},[]);
  const positive=rows.filter(row=>['interested','request_details','request_visit'].includes(row.response_kind)).length;
  const visits=rows.filter(row=>row.response_kind==='request_visit').length;
  const optOut=rows.filter(row=>row.response_kind==='opt_out').length;
  const visible=useMemo(()=>filter==='all'?rows:filter==='positive'?rows.filter(row=>['interested','request_details','request_visit'].includes(row.response_kind)):rows.filter(row=>row.response_kind===filter),[rows,filter]);
  return <div className="adminPanel" id="respostas-oportunidades"><div className="adminPanelHeader"><div><span className="eyebrow">RETORNO DOS COMPRADORES</span><h2>Respostas às oportunidades</h2><p>Centraliza o retorno recebido depois dos contatos de imóveis compatíveis.</p></div><span>{rows.length} recente(s)</span></div>
  <div className="statsGrid"><article><strong>{rows.length}</strong><span>respostas recentes</span></article><article><strong>{positive}</strong><span>sinais de interesse</span></article><article><strong>{visits}</strong><span>pedidos de visita</span></article><article><strong>{optOut}</strong><span>descadastros</span></article></div>
  <div className="adminFilters"><label>Mostrar<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas as respostas</option><option value="positive">Sinais de interesse</option><option value="request_visit">Pedidos de visita</option><option value="request_details">Pedidos de detalhes</option><option value="not_interested">Sem interesse</option><option value="opt_out">Descadastros</option></select></label></div>
  {message?<div className="formMessage">{message}</div>:null}
  <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Cliente</th><th>Imóvel</th><th>Resposta</th><th>Canal</th><th>Quando</th></tr></thead><tbody>{visible.length?visible.map(row=><tr key={row.id}><td><strong>{row.leads?.name||"Contato"}</strong></td><td><strong>{row.properties?.code||"—"}</strong><small className="tableSub">{row.properties?.title||""}</small></td><td><span className="statusPill">{labels[row.response_kind]||row.response_kind}</span><small className="tableSub" title={row.response_text||undefined}>{row.response_text?row.response_text.slice(0,220)+(row.response_text.length>220?"…":""):"Sem texto informado pelo provedor"}</small></td><td>{channels[row.channel]||row.channel}</td><td>{new Date(row.received_at).toLocaleString("pt-BR")}</td></tr>):<tr><td colSpan={5}>Nenhuma resposta nesta categoria.</td></tr>}</tbody></table></div></div>;
}
