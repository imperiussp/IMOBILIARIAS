"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Row={table_name:string;table_exists:boolean;has_agency_id:boolean;rls_enabled:boolean;policy_count:number;status:string;detail:string};

export default function PlatformTenantSecurityAudit(){
  const [rows,setRows]=useState<Row[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");

  useEffect(()=>{void(async()=>{
    if(!supabaseBrowser||!isSupabaseConfigured){setLoading(false);return;}
    const result=await supabaseBrowser.rpc("platform_tenant_security_audit");
    if(result.error){if(!["42883","42P01"].includes(result.error.code||""))setMessage(result.error.message);setLoading(false);return;}
    setRows((result.data||[]) as Row[]);setLoading(false);
  })();},[]);

  const critical=useMemo(()=>rows.filter(r=>r.status==="critical").length,[rows]);
  const missing=useMemo(()=>rows.filter(r=>r.status==="missing").length,[rows]);
  const ok=useMemo(()=>rows.filter(r=>r.status==="ok").length,[rows]);

  return <section className="adminPanel" id="auditoria-isolamento-tenant">
    <div className="adminPanelHeader"><div><span className="eyebrow">SEGURANÇA MULTI-IMOBILIÁRIA</span><h2>Auditoria de isolamento entre clientes</h2><p>Verifica estruturalmente RLS, coluna de tenant e policies nas tabelas críticas do SaaS.</p></div><span className="statusPill">{loading?"Verificando...":critical?`${critical} crítico(s)`:rows.length?"Estrutura protegida":"Aguardando banco"}</span></div>
    <div className="statsGrid"><article><strong>{ok}</strong><span>tabelas OK</span></article><article><strong>{critical}</strong><span>falhas críticas</span></article><article><strong>{missing}</strong><span>tabelas ainda ausentes</span></article><article><strong>{rows.reduce((sum,row)=>sum+Number(row.policy_count||0),0)}</strong><span>policies encontradas</span></article></div>
    <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Tabela</th><th>agency_id</th><th>RLS</th><th>Policies</th><th>Situação</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row.table_name}><td><strong>{row.table_name}</strong><small className="tableSub">{row.detail}</small></td><td>{row.has_agency_id?"OK":"NÃO"}</td><td>{row.rls_enabled?"ON":"OFF"}</td><td>{row.policy_count}</td><td><span className="statusPill">{row.status==="ok"?"OK":row.status==="missing"?"AUSENTE":"CRÍTICO"}</span></td></tr>):<tr><td colSpan={5}>A auditoria ficará disponível quando as migrations forem aplicadas no Supabase exclusivo do projeto.</td></tr>}</tbody></table></div>
    {message?<div className="formMessage">{message}</div>:null}
    <div className="formNotice"><strong>Importante:</strong> esta auditoria confirma a estrutura de proteção. O teste funcional entre duas imobiliárias diferentes continua obrigatório antes do lançamento.</div>
  </section>;
}
