"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Row={property_id:string;code:string;title:string;publication_state:string;status:string;quality_score:number;missing_photos:boolean;missing_cover:boolean;weak_description:boolean;missing_price:boolean};

export default function AdminPropertyQuality(){
  const [rows,setRows]=useState<Row[]>([]); const [message,setMessage]=useState("");
  useEffect(()=>{void(async()=>{ if(!supabaseBrowser) return; const agency=await getCurrentAgency(); if(!agency) return setMessage("Imobiliária ativa não encontrada."); const result=await supabaseBrowser.from("agency_property_quality").select("property_id,code,title,publication_state,status,quality_score,missing_photos,missing_cover,weak_description,missing_price").eq("agency_id",agency.agencyId).order("quality_score",{ascending:true}).limit(50); if(result.error&&result.error.code!=="42P01") return setMessage(result.error.message); setRows((result.data||[]) as Row[]); })();},[]);
  const excellent=rows.filter(r=>r.quality_score>=90).length; const attention=rows.filter(r=>r.quality_score<70).length;
  return <div className="adminPanel adminOnly" id="qualidade-imoveis"><div className="adminPanelHeader"><div><span className="eyebrow">QUALIDADE</span><h2>Qualidade dos anúncios</h2><p>Identifica imóveis sem fotos, capa, preço ou descrição suficiente antes de comprometer a apresentação do site.</p></div><span>{rows.length} analisado(s)</span></div><div className="adminMetrics planMetrics"><article><span>Excelente</span><strong>{excellent}</strong><small>90 pontos ou mais</small></article><article><span>Precisam atenção</span><strong>{attention}</strong><small>Abaixo de 70 pontos</small></article><article><span>Média</span><strong>{rows.length?Math.round(rows.reduce((s,r)=>s+r.quality_score,0)/rows.length):0}%</strong></article></div><div className="accessList">{rows.map(r=><article className="accessRow" key={r.property_id}><div className="accessIdentity"><strong>{r.code} · {r.title}</strong><span>{r.quality_score}% de qualidade</span><small>{[r.missing_photos?"sem fotos":"",r.missing_cover?"sem capa":"",r.missing_price?"sem preço":"",r.weak_description?"descrição curta":""].filter(Boolean).join(" · ")||"Cadastro completo"}</small></div><span className={`statusPill ${r.quality_score<70?"muted":""}`}>{r.quality_score>=90?"Excelente":r.quality_score>=70?"Bom":"Revisar"}</span></article>)}</div>{message?<div className="formMessage">{message}</div>:null}</div>;
}
