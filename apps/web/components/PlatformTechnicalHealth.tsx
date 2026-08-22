"use client";

import { useEffect,useState } from "react";

type Health={
  service:string;status:"ok"|"degraded";environment:string;
  checks:{web:boolean;supabase_configured:boolean;project_identity:boolean;project_ref_matches:boolean;indexing_enabled:boolean};
  identity:string|null;error:string|null;timestamp:string;
};

export default function PlatformTechnicalHealth(){
  const [data,setData]=useState<Health|null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);setMessage("");
    try{
      const response=await fetch("/api/health",{cache:"no-store"});
      const body=await response.json() as Health;
      setData(body);
      if(!response.ok)setMessage("A aplicação respondeu, mas existe configuração técnica pendente.");
    }catch{
      setMessage("Não foi possível consultar o health check da aplicação.");
    }finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[]);
  const checks=data?[
    ["Aplicação web",data.checks.web],
    ["Supabase configurado",data.checks.supabase_configured],
    ["Identidade IMOBILIARIAS",data.checks.project_identity],
    ["Project ref coerente",data.checks.project_ref_matches],
  ] as const:[];

  return <section className="adminPanel" id="saude-tecnica">
    <div className="adminPanelHeader"><div><span className="eyebrow">HEALTH CHECK</span><h2>Saúde técnica do deploy</h2><p>Confirma se a aplicação publicada está ligada ao Supabase correto sem expor credenciais.</p></div><div className="accessActions"><button className="miniButton" type="button" disabled={loading} onClick={()=>void load()}>{loading?"Verificando...":"Reverificar"}</button><span className="statusPill">{data?.status==="ok"?"SAUDÁVEL":data?"DEGRADADO":"AGUARDANDO"}</span></div></div>
    {data?<><div className="statsGrid">{checks.map(([label,ok])=><article key={label}><strong>{ok?"OK":"FALHA"}</strong><span>{label}</span></article>)}<article><strong>{data.checks.indexing_enabled?"ON":"OFF"}</strong><span>indexação</span></article></div><div className="formNotice"><strong>Identidade:</strong> {data.identity||"não confirmada"} · ambiente Node: {data.environment} · última leitura: {new Date(data.timestamp).toLocaleString("pt-BR")}</div></>:null}
    {message?<div className="formMessage">{message}</div>:null}
    <div className="formNotice"><strong>Regra:</strong> em homologação, saúde técnica deve estar OK e indexação deve permanecer OFF. O endpoint não retorna chaves, tokens nem service role.</div>
  </section>;
}
