"use client";

import { FormEvent, useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type State = { phone:string; whatsapp:string; instagram_url:string; facebook_url:string; youtube_url:string };
const empty:State={phone:"",whatsapp:"",instagram_url:"",facebook_url:"",youtube_url:""};

export default function AgencyContactSocialSettings(){
 const[data,setData]=useState<State>(empty);const[agencyId,setAgencyId]=useState("");const[message,setMessage]=useState("");const[saving,setSaving]=useState(false);
 useEffect(()=>{if(!supabaseBrowser)return;let active=true;void(async()=>{const current=await getCurrentAgency();if(!active||!current)return;setAgencyId(current.agencyId);const result=await supabaseBrowser.from("agencies").select("phone,whatsapp,instagram_url,facebook_url,youtube_url").eq("id",current.agencyId).maybeSingle();if(active&&result.data)setData({phone:result.data.phone||"",whatsapp:result.data.whatsapp||"",instagram_url:result.data.instagram_url||"",facebook_url:result.data.facebook_url||"",youtube_url:result.data.youtube_url||""});})();return()=>{active=false;};},[]);
 async function save(event:FormEvent){event.preventDefault();if(!supabaseBrowser||!agencyId)return;setSaving(true);setMessage("");const clean=(value:string)=>value.trim()||null;const result=await supabaseBrowser.from("agencies").update({phone:clean(data.phone),whatsapp:clean(data.whatsapp),instagram_url:clean(data.instagram_url),facebook_url:clean(data.facebook_url),youtube_url:clean(data.youtube_url)}).eq("id",agencyId);setSaving(false);setMessage(result.error?result.error.message:"Contato e redes sociais salvos.");}
 return <form className="adminPanel socialSettingsPanel" onSubmit={save}><div className="adminPanelHeader"><div><span className="eyebrow">CONTATO PÚBLICO</span><h2>Contato e redes sociais</h2><p>Esses dados aparecem no site e no menu móvel da imobiliária.</p></div></div><div className="formGrid"><label>Telefone<input value={data.phone} onChange={e=>setData({...data,phone:e.target.value})} placeholder="(00) 0000-0000"/></label><label>WhatsApp<input value={data.whatsapp} onChange={e=>setData({...data,whatsapp:e.target.value})} placeholder="(00) 00000-0000"/></label></div><label>Instagram<input value={data.instagram_url} onChange={e=>setData({...data,instagram_url:e.target.value})} placeholder="https://instagram.com/..."/></label><label>Facebook<input value={data.facebook_url} onChange={e=>setData({...data,facebook_url:e.target.value})} placeholder="https://facebook.com/..."/></label><label>YouTube<input value={data.youtube_url} onChange={e=>setData({...data,youtube_url:e.target.value})} placeholder="https://youtube.com/@..."/></label><button className="button primary" disabled={saving}>{saving?"Salvando...":"Salvar contato e redes"}</button>{message?<div className="formMessage">{message}</div>:null}</form>;
}
