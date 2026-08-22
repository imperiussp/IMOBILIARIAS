"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Row={check_key:string;label:string;category:string;required_for_production:boolean;validated:boolean;notes:string|null;validated_at:string|null};

export default function PlatformReleaseValidations(){
  const [rows,setRows]=useState<Row[]>([]);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const result=await supabaseBrowser.from("platform_release_validations").select("check_key,label,category,required_for_production,validated,notes,validated_at").order("category").order("label");
    if(result.error){if(!["42P01","42703"].includes(result.error.code||""))setMessage(result.error.message);return;}
    setRows((result.data||[]) as Row[]);
  }
  useEffect(()=>{void load();},[]);

  async function toggle(row:Row){
    if(!supabaseBrowser)return;
    setBusy(row.check_key);setMessage("");
    const result=await supabaseBrowser.from("platform_release_validations").update({validated:!row.validated}).eq("check_key",row.check_key);
    setBusy("");
    if(result.error){setMessage(result.error.message);return;}
    await load();
  }

  async function saveNotes(row:Row,notes:string){
    if(!supabaseBrowser)return;
    setBusy(row.check_key);setMessage("");
    const result=await supabaseBrowser.from("platform_release_validations").update({notes}).eq("check_key",row.check_key);
    setBusy("");
    if(result.error){setMessage(result.error.message);return;}
    await load();
  }

  const required=useMemo(()=>rows.filter(r=>r.required_for_production),[rows]);
  const pendingRequired=required.filter(r=>!r.validated).length;
  const done=rows.filter(r=>r.validated).length;

  return <section className="adminPanel" id="evidencias-homologacao">
    <div className="adminPanelHeader"><div><span className="eyebrow">EVIDÊNCIAS</span><h2>Checklist real de homologação</h2><p>Registro persistente do que foi efetivamente testado antes de colocar o SaaS em produção.</p></div><span className="statusPill">{pendingRequired?`${pendingRequired} obrigatório(s) pendente(s)`:`${done}/${rows.length} validado(s)`}</span></div>
    <div className="statsGrid"><article><strong>{done}</strong><span>testes validados</span></article><article><strong>{rows.length-done}</strong><span>testes pendentes</span></article><article><strong>{required.length}</strong><span>obrigatórios para produção</span></article><article><strong>{pendingRequired}</strong><span>bloqueios restantes</span></article></div>
    <div className="accessList">{rows.map(row=><article className="accessRow" key={row.check_key}><div className="accessIdentity" style={{flex:1}}><strong>{row.label}</strong><span>{row.category}{row.required_for_production?" · obrigatório para produção":" · recomendado"}</span><textarea defaultValue={row.notes||""} rows={2} placeholder="Observação/evidência do teste" onBlur={e=>{if(e.target.value!==(row.notes||""))void saveNotes(row,e.target.value);}}/><small>{row.validated_at?`Validado em ${new Date(row.validated_at).toLocaleString("pt-BR")}`:"Ainda não validado"}</small></div><div className="accessActions"><button type="button" className="miniButton" disabled={busy===row.check_key} onClick={()=>void toggle(row)}>{row.validated?"Reabrir teste":"Marcar validado"}</button><span className="statusPill">{row.validated?"OK":"PENDENTE"}</span></div></article>)}</div>
    {message?<div className="formMessage">{message}</div>:null}
    <div className="formNotice"><strong>Regra:</strong> marque como validado somente depois de executar o teste no ambiente exclusivo do LENOY IMOBILIÁRIAS.</div>
  </section>;
}
