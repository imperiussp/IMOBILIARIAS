"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Submission = {
  id:string; agency_id:string; lead_id:string; title:string|null; status:"pending"|"published"; published_property_id:string|null; published_at:string|null;
  owner_name:string; phone:string; email:string|null; address:string; city:string; state_code:string|null; neighborhood:string|null; property_type:string;
  purpose:"sale"|"rent"|"both"; bedrooms:number|null; bathrooms:number|null; garages:number|null; area_m2:number|null; requested_price:number|null;
  caixa_financeable:boolean|null; description:string; created_at:string; updated_at:string;
};
type SubmissionPhoto = { submission_id:string; storage_path:string; position:number };
type PhotoMap = Record<string,string[]>;
type Draft = Submission;

function money(value:number|null){return value==null?"Não informado":new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);}
function purposeLabel(value:Submission["purpose"]){return value==="rent"?"Locação":value==="both"?"Venda ou locação":"Venda";}
function financingLabel(value:boolean|null){return value===true?"Sim":value===false?"Não":"Não informado";}
function digits(value:string){return value.replace(/\D/g,"");}
function whatsappNumber(value:string){const clean=digits(value);return clean.startsWith("55")?clean:(clean.length>=10?`55${clean}`:clean);}
function nullableNumber(value:string){const parsed=Number(value);return value.trim()===""||!Number.isFinite(parsed)?null:parsed;}

function whatsappText(row:Submission,agencyName:string){
  return [
    `Olá, ${row.owner_name}! Aqui é da ${agencyName}.`,
    "Estou entrando em contato sobre o imóvel que você enviou para avaliação:",
    `Imóvel: ${row.title || row.property_type}`,
    `Endereço: ${row.address}${row.neighborhood?`, ${row.neighborhood}`:""} - ${row.city}${row.state_code?`/${row.state_code}`:""}`,
    `Tipo: ${row.property_type}`,
    `Finalidade: ${purposeLabel(row.purpose)}`,
    `Quartos: ${row.bedrooms ?? "não informado"} | Banheiros: ${row.bathrooms ?? "não informado"} | Garagens: ${row.garages ?? "não informado"}`,
    `Área: ${row.area_m2 ?? "não informada"}${row.area_m2!=null?" m²":""}`,
    `Valor informado: ${money(row.requested_price)}`,
    `Aceita financiamento: ${financingLabel(row.caixa_financeable)}`,
    `Descrição: ${row.description}`,
    "Gostaria de conversar com você sobre esta avaliação.",
  ].join("\n");
}

export default function OwnerPropertyReviewMount(){
  const[host,setHost]=useState<HTMLElement|null>(null);
  const[agencyId,setAgencyId]=useState("");
  const[agencyName,setAgencyName]=useState("");
  const[agencySlug,setAgencySlug]=useState("");
  const[rows,setRows]=useState<Submission[]>([]);
  const[photos,setPhotos]=useState<PhotoMap>({});
  const[loading,setLoading]=useState(true);
  const[message,setMessage]=useState("");
  const[editingId,setEditingId]=useState("");
  const[draft,setDraft]=useState<Draft|null>(null);
  const[busyId,setBusyId]=useState("");
  const[highlightId,setHighlightId]=useState("");

  useEffect(()=>{
    const pathname=window.location.pathname;
    const isApp=pathname.includes("/app");
    const isAdmin=pathname.includes("/admin");
    if(!isApp&&!isAdmin)return;
    if(isApp&&new URLSearchParams(window.location.search).get("view")!=="imoveis")return;
    let disposed=false; let observer:MutationObserver|null=null; let portalHost:HTMLElement|null=null;
    const mount=()=>{
      const anchor=isApp?document.querySelector(".livePropertiesOnly"):document.querySelector("#imoveis");
      if(!anchor||!anchor.parentElement||disposed)return;
      portalHost=document.createElement("div"); portalHost.className="ownerPropertyReviewPortalHost";
      anchor.parentElement.insertBefore(portalHost,anchor); setHost(portalHost); observer?.disconnect();
    };
    mount();
    if(!portalHost){observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});}
    return()=>{disposed=true;observer?.disconnect();portalHost?.remove();};
  },[]);

  async function load(){
    if(!supabaseBrowser)return;
    setLoading(true); setMessage("");
    const agency=await getCurrentAgency();
    if(!agency){setLoading(false);return;}
    setAgencyId(agency.agencyId); setAgencyName(agency.agencyName); setAgencySlug(agency.agencySlug);
    const result=await supabaseBrowser.from("owner_property_submissions")
      .select("id,agency_id,lead_id,title,status,published_property_id,published_at,owner_name,phone,email,address,city,state_code,neighborhood,property_type,purpose,bedrooms,bathrooms,garages,area_m2,requested_price,caixa_financeable,description,created_at,updated_at")
      .eq("agency_id",agency.agencyId).order("created_at",{ascending:false});
    if(result.error){setMessage(result.error.message);setLoading(false);return;}
    const submissions=(result.data||[]) as Submission[];
    submissions.sort((a,b)=>a.status===b.status?new Date(b.created_at).getTime()-new Date(a.created_at).getTime():a.status==="pending"?-1:1);
    setRows(submissions);
    const ids=submissions.map(row=>row.id);
    const nextPhotos:PhotoMap={};
    if(ids.length){
      const photoResult=await supabaseBrowser.from("owner_property_submission_photos").select("submission_id,storage_path,position").in("submission_id",ids).order("position");
      if(!photoResult.error){
        for(const photo of (photoResult.data||[]) as SubmissionPhoto[]){
          const signed=await supabaseBrowser.storage.from("owner-property-submissions").createSignedUrl(photo.storage_path,3600);
          if(!signed.error&&signed.data?.signedUrl)(nextPhotos[photo.submission_id] ||= []).push(signed.data.signedUrl);
        }
      }
    }
    setPhotos(nextPhotos);
    const params=new URLSearchParams(window.location.search); const lead=params.get("lead")||""; const submission=params.get("submission")||"";
    const target=submissions.find(row=>row.id===submission||row.lead_id===lead); if(target)setHighlightId(target.id);
    setLoading(false);
    if(target)window.setTimeout(()=>document.querySelector(`[data-owner-submission="${target.id}"]`)?.scrollIntoView({behavior:"smooth",block:"start"}),120);
  }

  useEffect(()=>{if(host)void load();},[host]);
  const pending=useMemo(()=>rows.filter(row=>row.status==="pending").length,[rows]);

  function beginEdit(row:Submission){setEditingId(row.id);setDraft({...row});setMessage("");}
  function cancelEdit(){setEditingId("");setDraft(null);}

  async function save(){
    if(!supabaseBrowser||!draft||!agencyId)return;
    if(!draft.title?.trim()||!draft.owner_name.trim()||!draft.phone.trim()||!draft.address.trim()||!draft.city.trim()||!draft.property_type.trim()||!draft.description.trim()){
      setMessage("Preencha os dados principais antes de salvar.");return;
    }
    setBusyId(draft.id);setMessage("");
    const patch={title:draft.title.trim(),owner_name:draft.owner_name.trim(),phone:draft.phone.trim(),email:draft.email?.trim()||null,address:draft.address.trim(),city:draft.city.trim(),state_code:draft.state_code?.trim().toUpperCase()||null,neighborhood:draft.neighborhood?.trim()||null,property_type:draft.property_type.trim(),purpose:draft.purpose,bedrooms:draft.bedrooms,bathrooms:draft.bathrooms,garages:draft.garages,area_m2:draft.area_m2,requested_price:draft.requested_price,caixa_financeable:draft.caixa_financeable,description:draft.description.trim()};
    const result=await supabaseBrowser.from("owner_property_submissions").update(patch).eq("id",draft.id).eq("agency_id",agencyId).select("id").single();
    setBusyId("");
    if(result.error){setMessage(result.error.message);return;}
    setRows(current=>current.map(row=>row.id===draft.id?{...row,...patch}:row));setMessage("Avaliação atualizada.");cancelEdit();
  }

  async function publish(row:Submission){
    if(!supabaseBrowser)return;
    if(row.purpose==="both"){setMessage("Antes de publicar, clique em Editar e escolha Venda ou Locação.");return;}
    if(!window.confirm(`Publicar “${row.title || row.property_type}” no site da imobiliária?`))return;
    setBusyId(row.id);setMessage("");
    const result=await supabaseBrowser.functions.invoke("publish-owner-property-submission",{body:{submission_id:row.id}});
    setBusyId("");
    const data=result.data as {ok?:boolean;property_id?:string;detail?:string;error?:string}|null;
    if(result.error||!data?.ok||!data.property_id){setMessage(data?.detail||result.error?.message||"Não foi possível publicar o imóvel.");return;}
    const now=new Date().toISOString();
    setRows(current=>current.map(item=>item.id===row.id?{...item,status:"published",published_property_id:data.property_id!,published_at:now}:item));
    setMessage("Imóvel publicado. Ele já está disponível no site e continua editável em Imóveis cadastrados.");
    window.setTimeout(()=>window.location.reload(),700);
  }

  function publicUrl(row:Submission){return row.published_property_id&&agencySlug?`https://${agencySlug}.imoveis.lenoy.com.br/imovel/?id=${encodeURIComponent(row.published_property_id)}`:"";}
  function catalogHref(){return window.location.pathname.includes("/app")?"/app/?view=imoveis#imoveis":"/admin/#imoveis";}

  if(!host)return null;
  return createPortal(<section className="ownerReviewPanel">
    <div className="ownerReviewHeading"><div><span>AVALIAÇÃO DE PROPRIETÁRIOS</span><h2>Imóveis para avaliação</h2><p>Recebidos pelo site. Só aparecem ao público depois de clicar em <strong>Publicar no site</strong>.</p></div><b>{pending} pendente{pending===1?"":"s"}</b></div>
    {message?<div className="ownerReviewMessage">{message}</div>:null}
    {loading?<div className="ownerReviewEmpty">Carregando avaliações...</div>:rows.length===0?<div className="ownerReviewEmpty">Nenhum imóvel enviado por proprietário até agora.</div>:<div className="ownerReviewList">{rows.map(row=>{
      const editing=editingId===row.id&&draft;
      const wa=whatsappNumber(row.phone);
      return <article key={row.id} data-owner-submission={row.id} className={`ownerReviewCard ${row.status}${highlightId===row.id?" highlight":""}`}>
        <div className="ownerReviewCardTop"><div><span>{row.status==="published"?"PUBLICADO":"AGUARDANDO AVALIAÇÃO"}</span><h3>{row.title || row.property_type}</h3><small>Enviado por {row.owner_name} em {new Date(row.created_at).toLocaleDateString("pt-BR")}</small></div><strong>{row.status==="published"?"Publicado":"Privado"}</strong></div>
        {photos[row.id]?.length?<div className="ownerReviewPhotos">{photos[row.id].map((url,index)=><img key={url} src={url} alt={`${row.title || row.property_type} - foto ${index+1}`}/>)}</div>:null}
        {editing&&row.status==="pending"?<div className="ownerReviewEdit">
          <label>Título<input value={draft!.title||""} onChange={e=>setDraft({...draft!,title:e.target.value})}/></label>
          <div className="ownerReviewGrid"><label>Proprietário<input value={draft!.owner_name} onChange={e=>setDraft({...draft!,owner_name:e.target.value})}/></label><label>WhatsApp<input value={draft!.phone} onChange={e=>setDraft({...draft!,phone:e.target.value})}/></label></div>
          <label>E-mail<input value={draft!.email||""} onChange={e=>setDraft({...draft!,email:e.target.value})}/></label>
          <label>Endereço<input value={draft!.address} onChange={e=>setDraft({...draft!,address:e.target.value})}/></label>
          <div className="ownerReviewGrid three"><label>Cidade<input value={draft!.city} onChange={e=>setDraft({...draft!,city:e.target.value})}/></label><label>UF<input maxLength={2} value={draft!.state_code||""} onChange={e=>setDraft({...draft!,state_code:e.target.value})}/></label><label>Bairro<input value={draft!.neighborhood||""} onChange={e=>setDraft({...draft!,neighborhood:e.target.value})}/></label></div>
          <div className="ownerReviewGrid"><label>Tipo<input value={draft!.property_type} onChange={e=>setDraft({...draft!,property_type:e.target.value})}/></label><label>Finalidade<select value={draft!.purpose} onChange={e=>setDraft({...draft!,purpose:e.target.value as Submission["purpose"]})}><option value="sale">Venda</option><option value="rent">Locação</option><option value="both">Venda ou locação</option></select></label></div>
          <div className="ownerReviewGrid four"><label>Quartos<input type="number" min="0" value={draft!.bedrooms??""} onChange={e=>setDraft({...draft!,bedrooms:nullableNumber(e.target.value)})}/></label><label>Banheiros<input type="number" min="0" value={draft!.bathrooms??""} onChange={e=>setDraft({...draft!,bathrooms:nullableNumber(e.target.value)})}/></label><label>Garagens<input type="number" min="0" value={draft!.garages??""} onChange={e=>setDraft({...draft!,garages:nullableNumber(e.target.value)})}/></label><label>Área m²<input type="number" min="0" step="0.01" value={draft!.area_m2??""} onChange={e=>setDraft({...draft!,area_m2:nullableNumber(e.target.value)})}/></label></div>
          <div className="ownerReviewGrid"><label>Valor informado<input type="number" min="0" step="0.01" value={draft!.requested_price??""} onChange={e=>setDraft({...draft!,requested_price:nullableNumber(e.target.value)})}/></label><label>Aceita financiamento?<select value={draft!.caixa_financeable===true?"yes":draft!.caixa_financeable===false?"no":""} onChange={e=>setDraft({...draft!,caixa_financeable:e.target.value==="yes"?true:e.target.value==="no"?false:null})}><option value="">Não informado</option><option value="yes">Sim</option><option value="no">Não</option></select></label></div>
          <label>Descrição<textarea rows={5} value={draft!.description} onChange={e=>setDraft({...draft!,description:e.target.value})}/></label>
          <div className="ownerReviewActions"><button type="button" onClick={cancelEdit}>Cancelar</button><button className="primary" type="button" disabled={busyId===row.id} onClick={()=>void save()}>{busyId===row.id?"Salvando...":"Salvar alterações"}</button></div>
        </div>:<>
          <div className="ownerReviewData"><div><span>Proprietário</span><strong>{row.owner_name}</strong><small>{row.phone}{row.email?` · ${row.email}`:""}</small></div><div><span>Local</span><strong>{row.address}</strong><small>{row.neighborhood?`${row.neighborhood} · `:""}{row.city}{row.state_code?`/${row.state_code}`:""}</small></div><div><span>Tipo / finalidade</span><strong>{row.property_type}</strong><small>{purposeLabel(row.purpose)}</small></div><div><span>Valor</span><strong>{money(row.requested_price)}</strong><small>Financiamento: {financingLabel(row.caixa_financeable)}</small></div><div><span>Características</span><strong>{row.bedrooms??"—"} qtos · {row.bathrooms??"—"} banh. · {row.garages??"—"} vagas</strong><small>{row.area_m2!=null?`${row.area_m2} m²`:"Área não informada"}</small></div></div>
          <div className="ownerReviewDescription"><span>Descrição enviada</span><p>{row.description}</p></div>
          <div className="ownerReviewActions">
            {row.status==="pending"?<button type="button" onClick={()=>beginEdit(row)}>Editar dados</button>:null}
            {wa?<a className="whatsapp" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${encodeURIComponent(whatsappText(row,agencyName||"imobiliária"))}`}>WhatsApp do proprietário</a>:null}
            {row.status==="pending"?<button className="publish" type="button" disabled={busyId===row.id} onClick={()=>void publish(row)}>{busyId===row.id?"Publicando...":"Publicar no site"}</button>:null}
            {publicUrl(row)?<a className="primary" target="_blank" rel="noreferrer" href={publicUrl(row)}>Ver anúncio</a>:null}
            {row.published_property_id?<a href={catalogHref()}>Editar em imóveis cadastrados</a>:null}
          </div>
        </>}
      </article>})}</div>}
    <style>{`
      .ownerReviewPanel{margin:0 0 22px;padding:18px;border-radius:20px;background:#fff;border:1px solid rgba(15,23,42,.12);box-shadow:0 14px 36px rgba(15,23,42,.06)}
      .ownerReviewHeading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}.ownerReviewHeading span,.ownerReviewCardTop span,.ownerReviewDescription span,.ownerReviewData span{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--tenant-primary,#173a63)}
      .ownerReviewHeading h2{margin:3px 0 4px;font-size:24px;color:#172033}.ownerReviewHeading p{margin:0;color:#64748b;font-size:13px}.ownerReviewHeading>b{padding:8px 11px;border-radius:999px;background:#fff7db;color:#8a5a00;font-size:12px;white-space:nowrap}
      .ownerReviewMessage{margin:10px 0;padding:10px 12px;border-radius:12px;background:#eef6ff;color:#173a63;font-size:13px}.ownerReviewEmpty{padding:18px;border-radius:14px;background:#f8fafc;color:#64748b;font-size:13px}.ownerReviewList{display:grid;gap:14px}.ownerReviewCard{border:1px solid #e2e8f0;border-radius:16px;padding:15px;background:#fff;scroll-margin-top:90px}.ownerReviewCard.pending{border-left:4px solid #f0b429}.ownerReviewCard.published{border-left:4px solid #22a06b}.ownerReviewCard.highlight{outline:3px solid rgba(240,180,41,.32)}
      .ownerReviewCardTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ownerReviewCardTop h3{margin:3px 0;font-size:19px;color:#172033}.ownerReviewCardTop small{color:#64748b}.ownerReviewCardTop>strong{font-size:11px;padding:6px 9px;border-radius:999px;background:#f1f5f9;color:#334155}.ownerReviewCard.pending .ownerReviewCardTop>strong{background:#fff7db;color:#8a5a00}.ownerReviewCard.published .ownerReviewCardTop>strong{background:#e8f7ef;color:#176b48}
      .ownerReviewPhotos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:13px 0}.ownerReviewPhotos img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;background:#eef2f6}.ownerReviewData{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.ownerReviewData>div{padding:10px;border-radius:12px;background:#f8fafc;display:grid;gap:3px}.ownerReviewData strong{font-size:13px;color:#172033}.ownerReviewData small{font-size:11px;color:#64748b}.ownerReviewDescription{margin-top:10px;padding:10px 12px;border:1px solid #eef2f6;border-radius:12px}.ownerReviewDescription p{margin:5px 0 0;white-space:pre-line;font-size:13px;line-height:1.5;color:#334155}
      .ownerReviewActions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ownerReviewActions button,.ownerReviewActions a{border:1px solid #cbd5e1;background:#fff;color:#172033;border-radius:10px;padding:9px 11px;font:inherit;font-size:12px;font-weight:800;text-decoration:none;cursor:pointer}.ownerReviewActions .publish,.ownerReviewActions .primary{background:var(--tenant-primary,#173a63);border-color:var(--tenant-primary,#173a63);color:#fff}.ownerReviewActions .whatsapp{background:#eaf8ef;border-color:#b8e4c8;color:#176b48}.ownerReviewActions button:disabled{opacity:.6;cursor:wait}
      .ownerReviewEdit{display:grid;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid #e2e8f0}.ownerReviewEdit label{display:grid;gap:5px;font-size:11px;font-weight:800;color:#475569}.ownerReviewEdit input,.ownerReviewEdit select,.ownerReviewEdit textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#fff;color:#172033;font:inherit;font-size:13px}.ownerReviewGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ownerReviewGrid.three{grid-template-columns:2fr .7fr 1.5fr}.ownerReviewGrid.four{grid-template-columns:repeat(4,minmax(0,1fr))}
      @media(max-width:720px){.ownerPropertyReviewPortalHost{margin:0 0 12px}.ownerReviewPanel{margin:0 12px 16px;padding:13px;border-radius:16px}.ownerReviewHeading{display:grid}.ownerReviewHeading h2{font-size:20px}.ownerReviewHeading>b{justify-self:start}.ownerReviewPhotos{grid-template-columns:repeat(2,minmax(0,1fr))}.ownerReviewData{grid-template-columns:1fr 1fr}.ownerReviewGrid,.ownerReviewGrid.three{grid-template-columns:1fr 1fr}.ownerReviewGrid.four{grid-template-columns:repeat(2,minmax(0,1fr))}.ownerReviewActions>*{flex:1 1 140px;text-align:center}.ownerReviewCardTop{align-items:flex-start}}
      @media(max-width:430px){.ownerReviewData,.ownerReviewGrid,.ownerReviewGrid.three{grid-template-columns:1fr}.ownerReviewCard{padding:12px}}
    `}</style>
  </section>,host);
}
