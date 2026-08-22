"use client";

import {FormEvent,useEffect,useMemo,useState} from "react";
import {isSupabaseConfigured,supabaseBrowser} from "../lib/supabaseBrowser";

type SmokeStatus="pending"|"passed"|"failed";
type EnvironmentMode="development"|"homologation"|"production";
type Row={id:string;environment_mode:EnvironmentMode;commit_sha:string;release_label:string|null;deployed_url:string|null;smoke_status:SmokeStatus;smoke_checked_at:string|null;rollback_candidate:boolean;active:boolean;notes:string|null;deployed_at:string};
type Draft={environment_mode:EnvironmentMode;commit_sha:string;release_label:string;deployed_url:string;smoke_status:SmokeStatus;rollback_candidate:boolean;active:boolean;notes:string};

const emptyDraft:Draft={environment_mode:"homologation",commit_sha:"",release_label:"",deployed_url:"",smoke_status:"pending",rollback_candidate:false,active:false,notes:""};

export default function PlatformDeploymentReleases(){
  const [rows,setRows]=useState<Row[]>([]);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [draft,setDraft]=useState<Draft>(emptyDraft);

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    setLoading(true);setMessage("");
    const result=await supabaseBrowser.from("platform_deployment_releases").select("id,environment_mode,commit_sha,release_label,deployed_url,smoke_status,smoke_checked_at,rollback_candidate,active,notes,deployed_at").order("deployed_at",{ascending:false}).limit(20);
    setLoading(false);
    if(result.error){if(!["42P01","42703"].includes(result.error.code||""))setMessage(result.error.message);return;}
    setRows((result.data||[]) as Row[]);
  }

  useEffect(()=>{void load();},[]);

  const editingRow=useMemo(()=>rows.find(row=>row.id===editingId)||null,[rows,editingId]);

  function resetForm(){setEditingId(null);setDraft(emptyDraft);setMessage("");}
  function edit(row:Row){
    setEditingId(row.id);
    setDraft({environment_mode:row.environment_mode,commit_sha:row.commit_sha,release_label:row.release_label||"",deployed_url:row.deployed_url||"",smoke_status:row.smoke_status,rollback_candidate:row.rollback_candidate,active:row.active,notes:row.notes||""});
    setMessage("");
    document.getElementById("release-editor")?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  async function save(event:FormEvent){
    event.preventDefault();
    if(!supabaseBrowser||!isSupabaseConfigured){setMessage("Supabase não configurado neste ambiente.");return;}
    const commit=draft.commit_sha.trim().toLowerCase();
    if(commit.length<7){setMessage("Informe um commit SHA com pelo menos 7 caracteres.");return;}
    if(draft.active&&draft.smoke_status!=="passed"){setMessage("Uma release só pode ser marcada como ativa após smoke test aprovado.");return;}
    if(draft.rollback_candidate&&draft.smoke_status!=="passed"){setMessage("Candidato a rollback deve ter smoke test aprovado.");return;}
    setSaving(true);setMessage("");
    const payload={environment_mode:draft.environment_mode,commit_sha:commit,release_label:draft.release_label.trim()||null,deployed_url:draft.deployed_url.trim()||null,smoke_status:draft.smoke_status,rollback_candidate:draft.rollback_candidate,active:draft.active,notes:draft.notes.trim()||null};
    const result=editingId
      ?await supabaseBrowser.from("platform_deployment_releases").update(payload).eq("id",editingId)
      :await supabaseBrowser.from("platform_deployment_releases").insert(payload);
    setSaving(false);
    if(result.error){setMessage(result.error.message);return;}
    setMessage(editingId?"Release atualizada.":"Release registrada.");
    setEditingId(null);setDraft(emptyDraft);
    await load();
  }

  return <section className="adminPanel" id="versoes-implantadas">
    <div className="adminPanelHeader"><div><span className="eyebrow">RELEASES</span><h2>Versões implantadas</h2><p>Registro técnico de commits publicados, smoke test, versão ativa e candidatos seguros a rollback.</p></div><button type="button" className="miniButton" disabled={loading} onClick={()=>void load()}>{loading?"Atualizando...":"Atualizar"}</button></div>

    <form id="release-editor" className="propertyForm releaseEditor" onSubmit={save}>
      <div className="formGrid three">
        <label>Ambiente<select value={draft.environment_mode} onChange={e=>setDraft(v=>({...v,environment_mode:e.target.value as EnvironmentMode}))} disabled={!!editingRow}><option value="development">Development</option><option value="homologation">Homologation</option><option value="production">Production</option></select></label>
        <label>Commit SHA<input value={draft.commit_sha} onChange={e=>setDraft(v=>({...v,commit_sha:e.target.value}))} placeholder="ex.: 0f4b0187" disabled={!!editingRow}/></label>
        <label>Rótulo da release<input value={draft.release_label} onChange={e=>setDraft(v=>({...v,release_label:e.target.value}))} placeholder="ex.: 2026.08.22-rc1"/></label>
      </div>
      <div className="formGrid">
        <label>URL implantada<input value={draft.deployed_url} onChange={e=>setDraft(v=>({...v,deployed_url:e.target.value}))} placeholder="https://..."/></label>
        <label>Smoke test<select value={draft.smoke_status} onChange={e=>setDraft(v=>({...v,smoke_status:e.target.value as SmokeStatus,active:e.target.value==="passed"?v.active:false,rollback_candidate:e.target.value==="passed"?v.rollback_candidate:false}))}><option value="pending">Pendente</option><option value="passed">Aprovado</option><option value="failed">Falhou</option></select></label>
      </div>
      <label>Notas<textarea rows={3} value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))} placeholder="Observações de deploy, smoke, rollback ou validação."/></label>
      <div className="releaseFlags"><label><input type="checkbox" checked={draft.rollback_candidate} disabled={draft.smoke_status!=="passed"} onChange={e=>setDraft(v=>({...v,rollback_candidate:e.target.checked}))}/> Candidato a rollback validado</label><label><input type="checkbox" checked={draft.active} disabled={draft.smoke_status!=="passed"} onChange={e=>setDraft(v=>({...v,active:e.target.checked}))}/> Marcar como release ativa</label></div>
      <div className="formActions"><button type="button" className="button secondary" onClick={resetForm}>{editingId?"Cancelar edição":"Limpar"}</button><button type="submit" className="button primary" disabled={saving}>{saving?"Salvando...":editingId?"Salvar alterações":"Registrar release"}</button></div>
    </form>

    {rows.length?<div className="accessList">{rows.map(row=><article className="accessRow" key={row.id}><div className="accessIdentity"><strong>{row.release_label||row.commit_sha.slice(0,12)}</strong><span>{row.environment_mode} · {row.commit_sha.slice(0,12)} · {row.deployed_url||"URL não registrada"}</span><small>Deploy: {new Date(row.deployed_at).toLocaleString("pt-BR")} · smoke: {row.smoke_status}{row.rollback_candidate?" · candidato a rollback":""}</small>{row.notes?<small>{row.notes}</small>:null}</div><div className="accessActions"><span className="statusPill">{row.active?"ATIVA":row.smoke_status==="passed"?"VALIDADA":row.smoke_status==="failed"?"FALHOU":"HISTÓRICO"}</span><button type="button" className="miniButton" onClick={()=>edit(row)}>Editar</button></div></article>)}</div>:<div className="formNotice"><strong>Nenhum deploy registrado ainda.</strong> Isso é esperado enquanto o projeto continua somente no código.</div>}
    {message?<div className="formMessage">{message}</div>:null}
    <div className="formNotice"><strong>Regra de segurança:</strong> não existe exclusão por esta interface. Release ativa e candidato a rollback exigem smoke test aprovado; o banco mantém apenas uma release ativa por ambiente.</div>
  </section>;
}
