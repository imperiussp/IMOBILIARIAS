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
  push_notifications_enabled:boolean;
  release_label:string;
  release_notes:string|null;
  updated_at:string;
  production_activated_at?:string|null;
};

const fallback:Controls={environment_mode:"homologation",maintenance_mode:false,public_catalog_enabled:true,new_registrations_enabled:false,real_billing_enabled:false,external_messaging_enabled:false,ai_generation_enabled:false,push_notifications_enabled:false,release_label:"Homologacao interna",release_notes:null,updated_at:new Date().toISOString(),production_activated_at:null};

function friendlyError(raw:string){
  if(raw.includes("Produção bloqueada:")) return raw;
  if(raw.includes("permission denied")||raw.includes("row-level security")) return "Apenas um administrador global da plataforma pode alterar estes controles.";
  return raw;
}

export default function PlatformReleaseControls(){
  const [data,setData]=useState<Controls>(fallback);
  const [draftLabel,setDraftLabel]=useState(fallback.release_label);
  const [draftNotes,setDraftNotes]=useState(fallback.release_notes||"");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const result=await supabaseBrowser.from("platform_release_controls").select("environment_mode,maintenance_mode,public_catalog_enabled,new_registrations_enabled,real_billing_enabled,external_messaging_enabled,ai_generation_enabled,push_notifications_enabled,release_label,release_notes,updated_at,production_activated_at").eq("id",1).maybeSingle();
    if(result.error){if(!["42P01","42703"].includes(result.error.code||""))setMessage(result.error.message);return;}
    if(result.data){
      const next=result.data as Controls;
      setData(next);setDraftLabel(next.release_label);setDraftNotes(next.release_notes||"");
    }
  }

  useEffect(()=>{void load();},[]);

  async function save(next:Controls, successMessage="Controles de ambiente atualizados e registrados no histórico."){
    if(!supabaseBrowser||!isSupabaseConfigured){setData(next);setMessage("Prévia local: controles ainda não gravados em Supabase.");return false;}
    setBusy(true);setMessage("");
    const {updated_at,production_activated_at,...payload}=next;
    const result=await supabaseBrowser.from("platform_release_controls").update(payload).eq("id",1).select("environment_mode,maintenance_mode,public_catalog_enabled,new_registrations_enabled,real_billing_enabled,external_messaging_enabled,ai_generation_enabled,push_notifications_enabled,release_label,release_notes,updated_at,production_activated_at").single();
    setBusy(false);
    if(result.error){setMessage(friendlyError(result.error.message));await load();return false;}
    const saved=result.data as Controls;
    setData(saved);setDraftLabel(saved.release_label);setDraftNotes(saved.release_notes||"");setMessage(successMessage);return true;
  }

  async function changeMode(mode:string){
    const next={...data,environment_mode:mode,release_label:draftLabel.trim()||data.release_label,release_notes:draftNotes.trim()||null};
    const promoted=mode==="production"&&data.environment_mode!=="production";
    await save(next,promoted?"Ambiente promovido para PRODUÇÃO com registro de auditoria.":"Modo de ambiente atualizado.");
  }

  async function saveReleaseIdentity(){
    if(draftLabel.trim().length<4)return setMessage("Informe uma identificação de release com pelo menos 4 caracteres.");
    await save({...data,release_label:draftLabel.trim(),release_notes:draftNotes.trim()||null},"Identificação e observações da release atualizadas.");
  }

  const sensitive=[data.new_registrations_enabled,data.real_billing_enabled,data.external_messaging_enabled,data.ai_generation_enabled,data.push_notifications_enabled].filter(Boolean).length;
  const notesReady=draftNotes.trim().length>=20;

  return <section className="adminPanel" id="controle-lancamento">
    <div className="adminPanelHeader"><div><span className="eyebrow">AMBIENTE</span><h2>Controle de homologação e lançamento</h2><p>Freios centrais para colocar o sistema na rede sem ativar recursos sensíveis antes da hora. A promoção para produção possui validação obrigatória no banco.</p></div><span className="statusPill">{data.environment_mode==="production"?"PRODUÇÃO":data.environment_mode==="development"?"DESENVOLVIMENTO":"HOMOLOGAÇÃO"}</span></div>

    <div className="statsGrid"><article><strong>{data.public_catalog_enabled?"ON":"OFF"}</strong><span>catálogo público</span></article><article><strong>{data.new_registrations_enabled?"ON":"OFF"}</strong><span>novos cadastros</span></article><article><strong>{data.real_billing_enabled?"ON":"OFF"}</strong><span>cobrança real</span></article><article><strong>{data.external_messaging_enabled?"ON":"OFF"}</strong><span>WhatsApp/e-mail</span></article><article><strong>{data.push_notifications_enabled?"ON":"OFF"}</strong><span>push do app</span></article><article><strong>{data.ai_generation_enabled?"ON":"OFF"}</strong><span>IA real</span></article><article><strong>{sensitive}/5</strong><span>recursos sensíveis liberados</span></article></div>

    <div className="propertyForm" style={{marginBottom:16}}>
      <div className="formGrid"><label>Identificação da release<input value={draftLabel} onChange={e=>setDraftLabel(e.target.value)} maxLength={120} placeholder="Ex.: Homologação 0.9" /></label><label>Ambiente<select value={data.environment_mode} disabled={busy} onChange={e=>void changeMode(e.target.value)}><option value="development">Desenvolvimento</option><option value="homologation">Homologação</option><option value="production">Produção</option></select></label></div>
      <label>Observações da release<textarea rows={3} value={draftNotes} onChange={e=>setDraftNotes(e.target.value)} maxLength={2000} placeholder="Registre o que foi validado, o objetivo desta versão e qualquer limitação conhecida." /></label>
      <div className="formActions"><button type="button" className="button secondary" disabled={busy} onClick={()=>void saveReleaseIdentity()}>{busy?"Salvando...":"Salvar identificação da release"}</button><span className="statusPill">{notesReady?"NOTAS OK":"NOTAS CURTAS"}</span></div>
      {data.environment_mode!=="production"?<div className="formNotice"><strong>Promoção para produção:</strong> exige catálogo ativo, modo manutenção desligado, execução de manutenção nas últimas 24h, nenhuma fila de provedor atrasada, identificação da release e ao menos 20 caracteres de observações.</div>:null}
    </div>

    <div className="accessList">
      {([
        ["maintenance_mode","Modo manutenção","Bloqueio operacional emergencial."],
        ["public_catalog_enabled","Catálogo público","Permite navegação pública dos imóveis publicados."],
        ["new_registrations_enabled","Novos cadastros","Libera entrada de novas imobiliárias/contas."],
        ["real_billing_enabled","Cobrança real","Autoriza criação de novas cobranças reais."],
        ["external_messaging_enabled","Mensageria externa","Autoriza WhatsApp/e-mail automáticos externos."],
        ["push_notifications_enabled","Push do aplicativo","Autoriza envio remoto de notificações aos dispositivos dos corretores."],
        ["ai_generation_enabled","IA real","Autoriza chamadas reais a provedores de IA."],
      ] as const).map(([key,title,desc])=><article className="accessRow" key={key}><div className="accessIdentity"><strong>{title}</strong><span>{desc}</span></div><div className="accessActions"><button type="button" className="miniButton" disabled={busy} onClick={()=>void save({...data,[key]:!data[key]})}>{data[key]?"Desativar":"Ativar"}</button><span className="statusPill">{data[key]?"ATIVO":"BLOQUEADO"}</span></div></article>)}
    </div>

    <div className="formNotice"><strong>Estado atual:</strong> {data.release_label}. Última alteração registrada em {new Date(data.updated_at).toLocaleString("pt-BR")}.{data.production_activated_at?` Produção ativada em ${new Date(data.production_activated_at).toLocaleString("pt-BR")}.`:""}</div>
    {message?<div className="formMessage">{message}</div>:null}
  </section>;
}
