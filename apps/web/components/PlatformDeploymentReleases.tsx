"use client";

import {useEffect,useState} from "react";
import {isSupabaseConfigured,supabaseBrowser} from "../lib/supabaseBrowser";

type Row={id:string;environment_mode:string;commit_sha:string;release_label:string|null;deployed_url:string|null;smoke_status:string;smoke_checked_at:string|null;rollback_candidate:boolean;active:boolean;notes:string|null;deployed_at:string};

export default function PlatformDeploymentReleases(){
  const [rows,setRows]=useState<Row[]>([]);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    setLoading(true);setMessage("");
    const result=await supabaseBrowser.from("platform_deployment_releases").select("id,environment_mode,commit_sha,release_label,deployed_url,smoke_status,smoke_checked_at,rollback_candidate,active,notes,deployed_at").order("deployed_at",{ascending:false}).limit(20);
    setLoading(false);
    if(result.error){if(!["42P01","42703"].includes(result.error.code||""))setMessage(result.error.message);return;}
    setRows((result.data||[]) as Row[]);
  }

  useEffect(()=>{void load();},[]);

  return <section className="adminPanel" id="versoes-implantadas">
    <div className="adminPanelHeader"><div><span className="eyebrow">RELEASES</span><h2>Versões implantadas</h2><p>Histórico técnico de commits publicados, smoke test e versões candidatas a rollback.</p></div><button type="button" className="miniButton" disabled={loading} onClick={()=>void load()}>{loading?"Atualizando...":"Atualizar"}</button></div>
    {rows.length?<div className="accessList">{rows.map(row=><article className="accessRow" key={row.id}><div className="accessIdentity"><strong>{row.release_label||row.commit_sha.slice(0,12)}</strong><span>{row.environment_mode} · {row.commit_sha.slice(0,12)} · {row.deployed_url||"URL não registrada"}</span><small>Deploy: {new Date(row.deployed_at).toLocaleString("pt-BR")} · smoke: {row.smoke_status}{row.rollback_candidate?" · candidato a rollback":""}</small>{row.notes?<small>{row.notes}</small>:null}</div><div className="accessActions"><span className="statusPill">{row.active?"ATIVA":row.smoke_status==="passed"?"VALIDADA":row.smoke_status==="failed"?"FALHOU":"HISTÓRICO"}</span></div></article>)}</div>:<div className="formNotice"><strong>Nenhum deploy registrado ainda.</strong> Isso é esperado enquanto o projeto continua somente no código.</div>}
    {message?<div className="formMessage">{message}</div>:null}
    <div className="formNotice"><strong>Uso:</strong> após cada publicação real, registre o commit implantado e o resultado do smoke test. Nunca marque uma versão como candidata a rollback sem tê-la validado anteriormente.</div>
  </section>;
}
