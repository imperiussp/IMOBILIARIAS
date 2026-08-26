"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

const PLATFORM_DOMAIN="imoveis.lenoy.com.br";
const MAIL_SERVER="pro126.dnspro.com.br";
const WEBMAIL_URL=`https://${MAIL_SERVER}:2096/`;
type Mailbox={id:string;email_address:string;quota_mb:number;status:string};
type Usage={plan_name:string;email_limit:number;used_emails:number;remaining_emails:number;can_create:boolean};
type Domain={hostname:string;verified:boolean;kind:string};

function strongPassword(v:string){return v.length>=12&&/[a-z]/.test(v)&&/[A-Z]/.test(v)&&/\d/.test(v)&&/[^A-Za-z0-9]/.test(v);}

export default function MobileProfessionalEmails(){
 const [agencyId,setAgencyId]=useState(""); const [mailboxes,setMailboxes]=useState<Mailbox[]>([]); const [usage,setUsage]=useState<Usage|null>(null); const [domains,setDomains]=useState<string[]>([PLATFORM_DOMAIN]);
 const [localPart,setLocalPart]=useState(""); const [domain,setDomain]=useState(PLATFORM_DOMAIN); const [password,setPassword]=useState(""); const [quota,setQuota]=useState("1024"); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 async function load(){if(!supabaseBrowser)return;const agency=await getCurrentAgency();if(!agency)return;setAgencyId(agency.agencyId);const [u,m,d]=await Promise.all([
  supabaseBrowser.rpc("agency_email_usage_snapshot",{p_agency_id:agency.agencyId}),
  supabaseBrowser.from("agency_mailboxes").select("id,email_address,quota_mb,status").eq("agency_id",agency.agencyId).is("deleted_at",null).order("created_at",{ascending:false}),
  supabaseBrowser.from("agency_domains").select("hostname,verified,kind").eq("agency_id",agency.agencyId).eq("verified",true),
 ]); const ur=Array.isArray(u.data)?u.data[0]:null; if(ur)setUsage(ur as Usage); if(!m.error)setMailboxes((m.data||[]) as Mailbox[]); const custom=((d.data||[]) as Domain[]).filter(x=>x.kind==="custom"&&x.verified).map(x=>x.hostname.replace(/^www\./,"")); setDomains(Array.from(new Set([PLATFORM_DOMAIN,...custom])));}
 useEffect(()=>{void load();},[]);
 const preview=useMemo(()=>`${localPart.trim().toLowerCase()||"nome"}@${domain}`,[localPart,domain]);
 async function create(e:FormEvent){e.preventDefault();if(!supabaseBrowser||!agencyId)return;if(!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(localPart.trim().toLowerCase()))return setMessage("Informe um nome de e-mail válido.");if(!strongPassword(password))return setMessage("A senha precisa ter 12+ caracteres, maiúscula, minúscula, número e símbolo.");setBusy(true);setMessage("");const result=await supabaseBrowser.functions.invoke("provision-professional-email",{body:{agency_id:agencyId,local_part:localPart.trim().toLowerCase(),domain,password,quota_mb:Number(quota)}});setBusy(false);if(result.error||!result.data?.ok)return setMessage("Não foi possível solicitar a criação dessa conta agora.");setLocalPart("");setPassword("");setMessage("Conta enviada para criação. Ela aparecerá como ativa assim que o servidor concluir.");await load();}
 return <div className="mobileEmailPanel">
  <a className="mobileWebmailButton" href={WEBMAIL_URL} target="_blank" rel="noreferrer">Abrir Webmail</a>
  <details className="mobileCollapsedModule"><summary><strong>Contas e configurações</strong><span>+</span></summary><div className="mobileCollapsedBody mobileModule">
   {usage?<div className="mobileEmailUsage"><strong>{usage.remaining_emails}</strong><span>conta(s) disponível(is) no {usage.plan_name}</span></div>:null}
   {mailboxes.length?<div className="mobileEmailList">{mailboxes.map(m=><article key={m.id}><strong>{m.email_address}</strong><small>{m.status==="active"?"Ativa":"Em processamento"} · {m.quota_mb>=1024?`${m.quota_mb/1024} GB`:`${m.quota_mb} MB`}</small></article>)}</div>:<div className="emptyMini">Nenhuma conta criada.</div>}
   <details className="mobileInlineDetails"><summary>Criar nova conta</summary><form className="propertyForm" onSubmit={create}><div className="formGrid"><label>Nome<input value={localPart} onChange={e=>setLocalPart(e.target.value.toLowerCase())} placeholder="contato"/></label><label>Domínio<select value={domain} onChange={e=>setDomain(e.target.value)}>{domains.map(x=><option key={x}>{x}</option>)}</select></label></div><div className="formNotice">Será criado: <strong>{preview}</strong></div><div className="formGrid"><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="12+ caracteres"/></label><label>Espaço<select value={quota} onChange={e=>setQuota(e.target.value)}><option value="512">512 MB</option><option value="1024">1 GB</option><option value="2048">2 GB</option></select></label></div><button className="button primary" disabled={busy||usage?.can_create===false}>{busy?"Enviando...":"Criar e-mail"}</button></form></details>
   <details className="mobileInlineDetails"><summary>Configurar no Gmail, Outlook ou celular</summary><div className="mobileMailSettings"><p><strong>Usuário:</strong> endereço completo do e-mail</p><p><strong>IMAP:</strong> {MAIL_SERVER} · 993 · SSL/TLS</p><p><strong>SMTP:</strong> {MAIL_SERVER} · 465 · SSL/TLS</p><p><strong>POP3:</strong> {MAIL_SERVER} · 995 · SSL/TLS</p></div></details>
  </div></details>{message?<div className="formMessage">{message}</div>:null}
 </div>;
}
