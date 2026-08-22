"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Check={sort_order:number;check_key:string;label:string;ok:boolean;detail:string;severity:string};
type Summary={total_checks:number;passed_checks:number;blockers:number;recommendations:number;optional_pending:number;readiness_percent:number};

const preview:Check[]=[
  {sort_order:10,check_key:"environment_mode",label:"Ambiente identificado",ok:true,detail:"Modo atual: homologation",severity:"required"},
  {sort_order:15,check_key:"release_identity",label:"Release identificada e documentada",ok:false,detail:"Inclua identificação e observações da release.",severity:"recommended"},
  {sort_order:20,check_key:"homologation_guard",label:"Freios externos coerentes com o ambiente",ok:true,detail:"Cobrança, mensageria, IA e push permanecem bloqueados.",severity:"required"},
  {sort_order:25,check_key:"deployment_network",label:"Infraestrutura necessária para homologação online",ok:false,detail:"Supabase, deploy web, DNS/HTTPS e cron ainda dependem da implantação real.",severity:"required"},
  {sort_order:30,check_key:"public_catalog",label:"Catálogo público disponível",ok:true,detail:"Catálogo público liberado para homologação.",severity:"recommended"},
  {sort_order:40,check_key:"maintenance_mode",label:"Modo manutenção desligado",ok:true,detail:"Operação normal permitida.",severity:"required"},
  {sort_order:50,check_key:"maintenance_recent",label:"Manutenção automática recente",ok:false,detail:"Ainda depende de execução real no ambiente Supabase.",severity:"recommended"},
  {sort_order:55,check_key:"maintenance_success",label:"Última manutenção concluída sem falhas",ok:false,detail:"Nenhuma execução real disponível nesta prévia.",severity:"recommended"},
  {sort_order:60,check_key:"provider_queue",label:"Fila técnica de provedores saudável",ok:true,detail:"Sem ambiente real conectado nesta prévia.",severity:"recommended"},
  {sort_order:65,check_key:"tenant_security",label:"Isolamento multi-imobiliária sem falhas críticas",ok:true,detail:"Auditoria estrutural preparada; validação real ocorre após aplicar as migrations.",severity:"required"},
  {sort_order:67,check_key:"required_validations",label:"Testes obrigatórios de homologação validados",ok:false,detail:"Evidências reais ainda precisam ser executadas no ambiente online.",severity:"recommended"},
  {sort_order:68,check_key:"deployment_production",label:"Infraestrutura obrigatória de produção concluída",ok:false,detail:"Backup, observabilidade e demais checkpoints ainda dependem da implantação.",severity:"recommended"},
  {sort_order:70,check_key:"billing_failures",label:"Sem falhas financeiras pendentes",ok:true,detail:"Cobrança real permanece bloqueada.",severity:"recommended"},
  {sort_order:80,check_key:"custom_domains",label:"Domínios personalizados sem pendência",ok:false,detail:"DNS real ainda será configurado.",severity:"optional"},
  {sort_order:90,check_key:"production_audit",label:"Promoção para produção registrada",ok:true,detail:"Ainda não promovido para produção.",severity:"required"},
];

function localSummary(rows:Check[]):Summary{
  const passed=rows.filter(x=>x.ok).length;
  return {total_checks:rows.length,passed_checks:passed,blockers:rows.filter(x=>!x.ok&&x.severity==="required").length,recommendations:rows.filter(x=>!x.ok&&x.severity==="recommended").length,optional_pending:rows.filter(x=>!x.ok&&x.severity==="optional").length,readiness_percent:rows.length?Math.round((passed/rows.length)*100):0};
}

export default function PlatformHomologationReadiness(){
  const [rows,setRows]=useState<Check[]>(preview);
  const [summary,setSummary]=useState<Summary>(localSummary(preview));
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    setLoading(true);
    const [checksResult,summaryResult]=await Promise.all([
      supabaseBrowser.from("platform_homologation_readiness").select("sort_order,check_key,label,ok,detail,severity").order("sort_order"),
      supabaseBrowser.from("platform_release_readiness_summary").select("total_checks,passed_checks,blockers,recommendations,optional_pending,readiness_percent").maybeSingle(),
    ]);
    setLoading(false);
    if(checksResult.error){if(!["42P01","42703"].includes(checksResult.error.code||""))setMessage(checksResult.error.message);return;}
    const nextRows=(checksResult.data||[]) as Check[];
    setRows(nextRows);
    if(!summaryResult.error&&summaryResult.data)setSummary(summaryResult.data as Summary);
    else setSummary(localSummary(nextRows));
  }

  useEffect(()=>{void load();},[]);
  const required=useMemo(()=>rows.filter(x=>x.severity==="required"),[rows]);
  const requiredPassed=required.filter(x=>x.ok).length;
  const releaseable=summary.blockers===0&&required.length>0;

  return <section className="adminPanel" id="prevoo-homologacao">
    <div className="adminPanelHeader"><div><span className="eyebrow">PRÉ-VOO V4</span><h2>Prontidão para colocar na rede</h2><p>Diagnóstico automático de código, banco, implantação, segurança e evidências. Produção continua protegida por validações no banco.</p></div><div className="accessActions"><button type="button" className="miniButton" disabled={loading} onClick={()=>void load()}>{loading?"Verificando...":"Reverificar"}</button><span className="statusPill">{summary.blockers?`${summary.blockers} BLOQUEIO(S)`:releaseable?"SEM BLOQUEIOS":"AGUARDANDO DADOS"}</span></div></div>

    <div className="statsGrid"><article><strong>{summary.readiness_percent}%</strong><span>prontidão geral</span></article><article><strong>{summary.passed_checks}/{summary.total_checks}</strong><span>itens aprovados</span></article><article><strong>{requiredPassed}/{required.length}</strong><span>obrigatórios aprovados</span></article><article><strong>{summary.blockers}</strong><span>bloqueios obrigatórios</span></article><article><strong>{summary.recommendations}</strong><span>recomendações</span></article><article><strong>{summary.optional_pending}</strong><span>opcionais pendentes</span></article></div>

    {releaseable?<div className="formNotice"><strong>Pré-voo sem bloqueios obrigatórios.</strong> Isso significa que os critérios atuais passaram; ainda não executa deploy, DNS ou ativação de credenciais automaticamente.</div>:<div className="formNotice"><strong>Ambiente ainda não liberável pelos critérios atuais.</strong> Corrija os itens marcados como BLOQUEIO antes de tentar promover para produção.</div>}

    <div className="accessList">{rows.map(item=><article className="accessRow" key={item.check_key}><div className="accessIdentity"><strong>{item.label}</strong><span>{item.detail}</span><small>{item.severity==="required"?"Obrigatório":item.severity==="recommended"?"Recomendado":"Opcional"}</small></div><div className="accessActions"><span className="statusPill">{item.ok?"OK":item.severity==="required"?"BLOQUEIO":"PENDENTE"}</span></div></article>)}</div>
    {message?<div className="formMessage">{message}</div>:null}
    <div className="formNotice"><strong>Importante:</strong> esta área apenas diagnostica. Publicação, migrations, DNS e credenciais continuam exigindo ativação deliberada no ambiente exclusivo do LENOY IMOBILIÁRIAS.</div>
  </section>;
}
