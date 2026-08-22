"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Row={id:string;environment_mode:string;maintenance_mode:boolean;public_catalog_enabled:boolean;new_registrations_enabled:boolean;real_billing_enabled:boolean;external_messaging_enabled:boolean;ai_generation_enabled:boolean;push_notifications_enabled:boolean;release_label:string;release_notes:string|null;changed_at:string;changed_by:string|null};

function onOff(value:boolean){return value?"ON":"OFF";}
function envLabel(value:string){return value==="production"?"Produção":value==="development"?"Desenvolvimento":"Homologação";}

export default function PlatformReleaseHistory(){
  const [rows,setRows]=useState<Row[]>([]);
  const [message,setMessage]=useState("");
  useEffect(()=>{void(async()=>{
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const result=await supabaseBrowser.from("platform_release_control_history")
      .select("id,environment_mode,maintenance_mode,public_catalog_enabled,new_registrations_enabled,real_billing_enabled,external_messaging_enabled,ai_generation_enabled,push_notifications_enabled,release_label,release_notes,changed_at,changed_by")
      .order("changed_at",{ascending:false}).limit(30);
    if(result.error){if(!["42P01","42703"].includes(result.error.code||""))setMessage(result.error.message);return;}
    setRows((result.data||[]) as Row[]);
  })();},[]);
  return <section className="adminPanel" id="historico-lancamento">
    <div className="adminPanelHeader"><div><span className="eyebrow">AUDITORIA</span><h2>Histórico do ambiente</h2><p>Últimas alterações dos freios de homologação, manutenção e lançamento.</p></div><span className="statusPill">{rows.length} registro(s)</span></div>
    <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Quando</th><th>Ambiente</th><th>Manutenção</th><th>Catálogo</th><th>Cadastros</th><th>Cobrança</th><th>WhatsApp/e-mail</th><th>Push</th><th>IA</th><th>Release</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row.id}><td>{new Date(row.changed_at).toLocaleString("pt-BR")}</td><td>{envLabel(row.environment_mode)}</td><td>{row.maintenance_mode?"ATIVA":"OFF"}</td><td>{onOff(row.public_catalog_enabled)}</td><td>{onOff(row.new_registrations_enabled)}</td><td>{onOff(row.real_billing_enabled)}</td><td>{onOff(row.external_messaging_enabled)}</td><td>{onOff(row.push_notifications_enabled)}</td><td>{onOff(row.ai_generation_enabled)}</td><td><strong>{row.release_label}</strong>{row.release_notes?<small className="tableSub">{row.release_notes}</small>:null}</td></tr>):<tr><td colSpan={10}>Nenhuma alteração registrada ainda.</td></tr>}</tbody></table></div>
    {message?<div className="formMessage">{message}</div>:null}
  </section>;
}
