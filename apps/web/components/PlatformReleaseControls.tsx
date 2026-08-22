"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Controls={
  environment_mode:string;
  maintenance_mode:boolean;
  public_catalog_enabled:boolean;
  new_registrations_enabled:boolean;
  real_billing_enabled:boolean;
  external_messaging_enabled:boolean;
  ai_generation_enabled:boolean;
  release_label:string;
  release_notes:string|null;
  updated_at:string;
};

const fallback:Controls={environment_mode:"homologation",maintenance_mode:false,public_catalog_enabled:true,new_registrations_enabled:false,real_billing_enabled:false,external_messaging_enabled:false,ai_generation_enabled:false,release_label:"Homologacao interna",release_notes:null,updated_at:new Date().toISOString()};

export default function PlatformReleaseControls(){
  const [data,setData]=useState<Controls>(fallback);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const result=await supabaseBrowser.from("platform_release_controls").select("environment_mode,maintenance_mode,public_catalog_enabled,new_registrations_enabled,real_billing_enabled,external_messaging_enabled,ai_generation_enabled,release_label,release_notes,updated_at").eq("id",1).maybeSingle();
    if(result.error){if(!["42P01","42703"].includes(result.error.code||""))setMessage(result.error.message);return;}
    if(result.data)setData(result.data as Controls);
  }

  useEffect(()=>{void load();},[]);

  async function save(next:Controls){
    setData(next);
    if(!supabaseBrowser||!isSupabaseConfigured){setMessage("Prévia local: controles ainda não gravados em Supabase.");return;}
    setBusy(true);setMessage("");
    const {updated_at,...payload}=next;
    const result=await supabaseBrowser.from("platform_release_controls").update(payload).eq("id",1).select("environment_mode,maintenance_mode,public_catalog_enabled,new_registrations_enabled,real_billing_enabled,external_messaging_enabled,ai_generation_enabled,release_label,release_notes,updated_at").single();
    setBusy(false);
    if(result.error){setMessage(result.error.message);return;}
    setData(result.data as Controls);setMessage("Controles de ambiente atualizados e registrados no histórico.");
  }

  const guarded=[data.new_registrations_enabled,data.real_billing_enabled,data.external_messaging_enabled,data.ai_generation_enabled].filter(Boolean).length;
  return <section className="adminPanel" id="controle-lancamento">
    <div className="adminPanelHeader"><div><span className="eyebrow">AMBIENTE</span><h2>Controle de homologação e lançamento</h2><p>Freios centrais para colocar o sistema na rede sem ativar recursos sensíveis antes da hora.</p></div><span className="statusPill">{data.environment_mode==="production"?"PRODUÇÃO":data.environment_mode==="development"?"DESENVOLVIMENTO":"HOMOLOGAÇÃO"}</span></div>
    <div className="statsGrid"><article><strong>{data.public_catalog_enabled?"ON":"OFF"}</strong><span>catálogo público</span></article><article><strong>{data.new_registrations_enabled?"ON":"OFF"}</strong><span>novos cadastros</span></article><article><strong>{data.real_billing_enabled?"ON":"OFF"}</strong><span>cobrança real</span></article><article><strong>{data.external_messaging_enabled?"ON":"OFF"}</strong><span>mensageria externa</span></article><article><strong>{data.ai_generation_enabled?"ON":"OFF"}</strong><span>IA real</span></article><article><strong>{guarded}/4</strong><span>recursos sensíveis liberados</span></article></div>
    <div className="adminFilters"><label>Ambiente<select value={data.environment_mode} disabled={busy} onChange={e=>void save({...data,environment_mode:e.target.value})}><option value="development">Desenvolvimento</option><option value="homologation">Homologação</option><option value="production">Produção</option></select></label></div>
    <div className="accessList">
      {([
        ["maintenance_mode","Modo manutenção","Bloqueio operacional emergencial."],
        ["public_catalog_enabled","Catálogo público","Permite navegação pública dos imóveis publicados."],
        ["new_registrations_enabled","Novos cadastros","Libera entrada de novas imobiliárias/contas."],
        ["real_billing_enabled","Cobrança real","Autoriza fluxos reais de cobrança."],
        ["external_messaging_enabled","Mensageria externa","Autoriza WhatsApp/e-mail automáticos externos."],
        ["ai_generation_enabled","IA real","Autoriza chamadas reais a provedores de IA."],
      ] as const).map(([key,title,desc])=><article className="accessRow" key={key}><div className="accessIdentity"><strong>{title}</strong><span>{desc}</span></div><div className="accessActions"><button type="button" className="miniButton" disabled={busy} onClick={()=>void save({...data,[key]:!data[key]})}>{data[key]?"Desativar":"Ativar"}</button><span className="statusPill">{data[key]?"ATIVO":"BLOQUEADO"}</span></div></article>)}
    </div>
    <div className="formNotice"><strong>Estado atual:</strong> {data.release_label}. Última alteração registrada em {new Date(data.updated_at).toLocaleString("pt-BR")}.</div>
    {message?<div className="formMessage">{message}</div>:null}
  </section>;
}
