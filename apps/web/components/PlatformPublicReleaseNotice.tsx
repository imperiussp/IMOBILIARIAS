"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type State={environment:string;label:string;registrationOpen:boolean}|null;

export default function PlatformPublicReleaseNotice(){
  const [state,setState]=useState<State>(null);
  useEffect(()=>{void(async()=>{
    if(!supabaseBrowser||!isSupabaseConfigured){setState({environment:"preview",label:"Prévia de desenvolvimento",registrationOpen:false});return;}
    const result=await supabaseBrowser.rpc("platform_registration_status");
    if(result.error)return;
    const row=Array.isArray(result.data)?result.data[0]:result.data as any;
    if(!row)return;
    setState({environment:String(row.environment_mode||"unknown"),label:String(row.release_label||"Ambiente controlado"),registrationOpen:row.enabled===true});
  })();},[]);
  if(!state||state.environment==="production"||state.registrationOpen)return null;
  return <div className="container"><div className="formNotice" style={{marginTop:16}}><strong>AMBIENTE DE HOMOLOGAÇÃO:</strong> {state.label}. Novos cadastros de imobiliárias estão bloqueados. Recursos externos permanecem sujeitos aos controles globais da plataforma.</div></div>;
}
