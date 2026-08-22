"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Check={sort_order:number;check_key:string;label:string;ok:boolean;detail:string;severity:string};

const preview:Check[]=[
  {sort_order:10,check_key:"environment_mode",label:"Ambiente identificado",ok:true,detail:"Modo atual: homologation",severity:"required"},
  {sort_order:20,check_key:"homologation_guard",label:"Freios de homologação ativos",ok:true,detail:"Cobrança real e mensageria externa bloqueadas.",severity:"required"},
  {sort_order:30,check_key:"public_catalog",label:"Catálogo público disponível",ok:true,detail:"Pode exibir imóveis publicados durante homologação.",severity:"recommended"},
  {sort_order:40,check_key:"maintenance_mode",label:"Modo manutenção desligado",ok:true,detail:"Operação normal permitida.",severity:"required"},
  {sort_order:50,check_key:"maintenance_recent",label:"Manutenção automática recente",ok:false,detail:"Ainda depende de deploy e cron reais.",severity:"recommended"},
  {sort_order:60,check_key:"provider_queue",label:"Fila técnica de provedores saudável",ok:true,detail:"Sem ambiente real conectado nesta prévia.",severity:"recommended"},
  {sort_order:70,check_key:"billing_failures",label:"Sem falhas financeiras pendentes",ok:true,detail:"Cobrança real permanece bloqueada.",severity:"recommended"},
  {sort_order:80,check_key:"custom_domains",label:"Domínios personalizados sem pendência",ok:false,detail:"DNS real ainda será configurado.",severity:"optional"},
];

export default function PlatformHomologationReadiness(){
  const [rows,setRows]=useState<Check[]>(preview);
  const [message,setMessage]=useState("");
  useEffect(()=>{void(async()=>{
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const result=await supabaseBrowser.from("platform_homologation_readiness").select("sort_order,check_key,label,ok,detail,severity").order("sort_order");
    if(result.error){if(!["42P01","42703"].includes(result.error.code||""))setMessage(result.error.message);return;}
    setRows((result.data||[]) as Check[]);
  })();},[]);
  const required=useMemo(()=>rows.filter(x=>x.severity==="required"),[rows]);
  const blockers=required.filter(x=>!x.ok).length;
  const passed=rows.filter(x=>x.ok).length;
  const readiness=rows.length?Math.round((passed/rows.length)*100):0;
  return <section className="adminPanel" id="prevoo-homologacao">
    <div className="adminPanelHeader"><div><span className="eyebrow">PRÉ-VOO</span><h2>Prontidão para colocar na rede</h2><p>Diagnóstico automático sem ativar produção, cobrança ou integrações externas.</p></div><span className="statusPill">{blockers?`${blockers} bloqueio(s)`:`${readiness}% preparado`}</span></div>
    <div className="statsGrid"><article><strong>{readiness}%</strong><span>itens aprovados</span></article><article><strong>{blockers}</strong><span>bloqueios obrigatórios</span></article><article><strong>{rows.filter(x=>!x.ok&&x.severity==="recommended").length}</strong><span>recomendações pendentes</span></article><article><strong>{rows.filter(x=>!x.ok&&x.severity==="optional").length}</strong><span>itens opcionais</span></article></div>
    <div className="accessList">{rows.map(item=><article className="accessRow" key={item.check_key}><div className="accessIdentity"><strong>{item.label}</strong><span>{item.detail}</span></div><div className="accessActions"><span className="statusPill">{item.ok?"OK":item.severity==="required"?"BLOQUEIO":"PENDENTE"}</span></div></article>)}</div>
    {message?<div className="formMessage">{message}</div>:null}
    <div className="formNotice"><strong>Importante:</strong> esta área apenas diagnostica. Publicação, migrations, DNS e credenciais continuam exigindo ativação deliberada no ambiente exclusivo do LENOY IMOBILIÁRIAS.</div>
  </section>;
}
