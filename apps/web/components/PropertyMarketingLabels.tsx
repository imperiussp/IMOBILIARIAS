"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Row={id:string;title:string;code:string;display_code:string|null;marketing_label:string|null};
const suggestions=["","Lançamento","Promoção","Última chance","Exclusivo","Oportunidade"];

export default function PropertyMarketingLabels(){
 const[rows,setRows]=useState<Row[]>([]),[agencyId,setAgencyId]=useState(""),[message,setMessage]=useState("");
 async function load(){if(!supabaseBrowser)return;const current=await getCurrentAgency();if(!current)return;setAgencyId(current.agencyId);const result=await supabaseBrowser.from("properties").select("id,title,code,display_code,marketing_label").eq("agency_id",current.agencyId).order("created_at",{ascending:false});if(!result.error)setRows((result.data||[]) as Row[]);}
 useEffect(()=>{void load();},[]);
 async function save(row:Row,label:string){if(!supabaseBrowser||!agencyId)return;const value=label.trim().slice(0,40)||null;const result=await supabaseBrowser.from("properties").update({marketing_label:value}).eq("id",row.id).eq("agency_id",agencyId);if(result.error)return setMessage(result.error.message);setRows(current=>current.map(item=>item.id===row.id?{...item,marketing_label:value}:item));setMessage(`Etiqueta de ${row.display_code||row.code} atualizada.`);}
 return <div className="propertyLabelManager"><p className="formNotice">Use uma etiqueta curta para destacar a primeira foto do anúncio.</p>{message?<div className="formMessage">{message}</div>:null}<div className="propertyLabelRows">{rows.map(row=><article key={row.id}><div><small>Ref. {row.display_code||row.code}</small><strong>{row.title}</strong></div><div className="propertyLabelControls"><input list={`labels-${row.id}`} defaultValue={row.marketing_label||""} placeholder="Ex.: Última chance" maxLength={40} onBlur={e=>void save(row,e.target.value)}/><datalist id={`labels-${row.id}`}>{suggestions.filter(Boolean).map(item=><option key={item} value={item}/>)}</datalist><button type="button" onClick={event=>{const input=event.currentTarget.previousElementSibling as HTMLInputElement|null;if(input)void save(row,input.value);}}>Salvar</button></div></article>)}</div>{!rows.length?<div className="emptyMini">Nenhum imóvel cadastrado.</div>:null}</div>;
}
