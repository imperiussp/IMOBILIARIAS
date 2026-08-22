"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Row={
  checkpoint_key:string;label:string;category:string;required_for_network:boolean;required_for_production:boolean;
  completed:boolean;completed_at:string|null;notes:string|null;
};
type Summary={network_total:number;network_done:number;network_blockers:number;production_total:number;production_done:number;production_blockers:number};
type History={id:string;checkpoint_key:string;previous_completed:boolean|null;current_completed:boolean;current_notes:string|null;changed_at:string};

const categoryLabel:Record<string,string>={database:"Banco",backend:"Backend",web:"Web",dns:"DNS/HTTPS",operations:"Operação",integration:"Integração"};

export default function PlatformDeploymentCheckpoints(){
  const [rows,setRows]=useState<Row[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [history,setHistory]=useState<History[]>([]);
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState<string|null>(null);

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const [listResult,summaryResult,historyResult]=await Promise.all([
      supabaseBrowser.from("platform_deployment_checkpoints").select("checkpoint_key,label,category,required_for_network,required_for_production,completed,completed_at,notes").order("category").order("label"),
      supabaseBrowser.from("platform_deployment_readiness_summary").select("network_total,network_done,network_blockers,production_total,production_done,production_blockers").maybeSingle(),
      supabaseBrowser.from("platform_deployment_checkpoint_history").select("id,checkpoint_key,previous_completed,current_completed,current_notes,changed_at").order("changed_at",{ascending:false}).limit(10),
    ]);
    if(listResult.error){if(!["42P01","42703"].includes(listResult.error.code||""))setMessage(listResult.error.message);return;}
    setRows((listResult.data||[]) as Row[]);
    if(!summaryResult.error&&summaryResult.data)setSummary(summaryResult.data as Summary);
    if(!historyResult.error)setHistory((historyResult.data||[]) as History[]);
  }

  useEffect(()=>{void load();},[]);

  async function toggle(row:Row){
    if(!supabaseBrowser)return;
    setSaving(row.checkpoint_key);setMessage("");
    const result=await supabaseBrowser.from("platform_deployment_checkpoints").update({completed:!row.completed}).eq("checkpoint_key",row.checkpoint_key);
    setSaving(null);
    if(result.error){setMessage(result.error.message);return;}
    await load();
  }

  async function saveNotes(row:Row,notes:string){
    if(!supabaseBrowser)return;
    setSaving(row.checkpoint_key);setMessage("");
    const result=await supabaseBrowser.from("platform_deployment_checkpoints").update({notes:notes.trim()||null}).eq("checkpoint_key",row.checkpoint_key);
    setSaving(null);
    if(result.error){setMessage(result.error.message);return;}
    await load();
  }

  const networkPercent=useMemo(()=>summary&&summary.network_total?Math.round((summary.network_done/summary.network_total)*100):0,[summary]);
  const productionPercent=useMemo(()=>summary&&summary.production_total?Math.round((summary.production_done/summary.production_total)*100):0,[summary]);
  const labels=useMemo(()=>Object.fromEntries(rows.map(row=>[row.checkpoint_key,row.label])),[rows]);

  return <section className="adminPanel" id="implantacao-real">
    <div className="adminPanelHeader"><div><span className="eyebrow">IMPLANTAÇÃO</span><h2>Checklist para colocar na rede</h2><p>Infraestrutura real separada dos testes funcionais. Marque apenas depois de confirmar cada item no ambiente do IMOBILIARIAS.</p></div><span className="statusPill">{summary?`${summary.network_blockers} PENDENTE(S) PARA REDE`:"AGUARDANDO"}</span></div>
    {summary?<div className="statsGrid"><article><strong>{networkPercent}%</strong><span>pronto para homologação online</span></article><article><strong>{summary.network_done}/{summary.network_total}</strong><span>itens de rede concluídos</span></article><article><strong>{summary.network_blockers}</strong><span>pendências para rede</span></article><article><strong>{productionPercent}%</strong><span>infra de produção</span></article><article><strong>{summary.production_blockers}</strong><span>pendências para produção</span></article></div>:null}
    <div className="accessList">{rows.map(row=><article className="accessRow" key={row.checkpoint_key}><div className="accessIdentity"><strong>{row.label}</strong><span>{categoryLabel[row.category]||row.category} · {row.required_for_network?"necessário para rede":row.required_for_production?"necessário para produção":"opcional/integração"}</span><small>{row.completed_at?`Confirmado em ${new Date(row.completed_at).toLocaleString("pt-BR")}`:"Ainda não confirmado"}</small><input className="adminInput" defaultValue={row.notes||""} placeholder="Observação/evidência" onBlur={e=>{if((e.target.value||"").trim()!==(row.notes||""))void saveNotes(row,e.target.value);}} /></div><div className="accessActions"><button type="button" className="miniButton" disabled={saving===row.checkpoint_key} onClick={()=>void toggle(row)}>{saving===row.checkpoint_key?"Salvando...":row.completed?"Marcar pendente":"Confirmar"}</button><span className="statusPill">{row.completed?"OK":"PENDENTE"}</span></div></article>)}</div>
    {history.length?<><div className="adminPanelHeader"><div><span className="eyebrow">AUDITORIA</span><h3>Últimas alterações da implantação</h3><p>Registro recente de confirmações, reaberturas e observações.</p></div></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Quando</th><th>Item</th><th>Estado</th><th>Observação</th></tr></thead><tbody>{history.map(item=><tr key={item.id}><td>{new Date(item.changed_at).toLocaleString("pt-BR")}</td><td>{labels[item.checkpoint_key]||item.checkpoint_key}</td><td>{item.current_completed?"Confirmado":"Pendente"}</td><td>{item.current_notes||"—"}</td></tr>)}</tbody></table></div></>:null}
    {message?<div className="formMessage">{message}</div>:null}
    <div className="formNotice"><strong>Regra:</strong> esta checklist registra evidência operacional; ela não executa deploy, não cria DNS e não aplica migrations sozinha.</div>
  </section>;
}
