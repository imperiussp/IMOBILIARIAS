"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Row={id:string;response_kind:string;response_text:string|null;channel:string;received_at:string;leads?:{name?:string|null}|null;properties?:{code?:string|null;title?:string|null}|null};
const labels:Record<string,string>={reply:"Resposta",interested:"Interessado",not_interested:"Sem interesse",request_details:"Pediu detalhes",request_visit:"Pediu visita",opt_out:"Não quer receber",other:"Outro"};

export default function AdminBuyerOutreachResponses(){
  const [rows,setRows]=useState<Row[]>([]); const [message,setMessage]=useState("");
  async function load(){if(!supabaseBrowser||!isSupabaseConfigured)return; const agency=await getCurrentAgency(); if(!agency)return; const {data,error}=await supabaseBrowser.from("buyer_outreach_responses").select("id,response_kind,response_text,channel,received_at,leads(name),properties(code,title)").eq("agency_id",agency.agencyId).order("received_at",{ascending:false}).limit(40); if(error){if(!['42P01','42703'].includes(error.code||''))setMessage(error.message);return;} setRows((data||[]) as unknown as Row[]);}
  useEffect(()=>{void load();},[]);
  return <div className="adminPanel" id="respostas-oportunidades"><div className="adminPanelHeader"><div><span className="eyebrow">RETORNO DOS COMPRADORES</span><h2>Respostas às oportunidades</h2><p>Centraliza o retorno recebido depois dos contatos de imóveis compatíveis.</p></div><span>{rows.length} recente(s)</span></div>
  {message?<div className="formMessage">{message}</div>:null}
  <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Cliente</th><th>Imóvel</th><th>Resposta</th><th>Canal</th><th>Quando</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row.id}><td>{row.leads?.name||"Contato"}</td><td><strong>{row.properties?.code||"—"}</strong><small className="tableSub">{row.properties?.title||""}</small></td><td><span className="statusPill">{labels[row.response_kind]||row.response_kind}</span><small className="tableSub">{row.response_text||"Sem texto informado pelo provedor"}</small></td><td>{row.channel}</td><td>{new Date(row.received_at).toLocaleString("pt-BR")}</td></tr>):<tr><td colSpan={5}>Nenhuma resposta registrada ainda.</td></tr>}</tbody></table></div></div>;
}
