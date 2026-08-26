"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getPropertyPhotoUrls } from "../lib/propertyPhotos";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import { currentHostname, resolveCurrentTenant } from "../lib/tenantResolver";
import { useSiteSettings } from "../lib/useSiteSettings";
import PublicHeader from "./PublicHeader";

type CatalogRow = {
  id: string; agency_id: string; code: string; title: string; description: string | null; purpose: "sale" | "rent"; zone: "urban" | "rural";
  segment?: "residential" | "commercial"; status: string; price: number; bedrooms: number | null; suites: number | null;
  bathrooms: number | null; parking_spaces: number | null; built_area_m2: number | null; land_area_m2: number | null;
  city: string; state_code: string; neighborhood: string | null; property_type: string | null; broker_name: string | null;
  broker_whatsapp: string | null; broker_creci: string | null; broker_area_of_operation?: string | null; address: string | null; address_public: boolean;
  marketing_label?: string | null; latitude?: number | null; longitude?: number | null;
};
type Photo = { id: string; storage_path: string; thumbnail_path?: string | null; position: number; is_cover: boolean; alt_text: string | null };
type FeatureLink = { property_features: { name: string } | { name: string }[] | null };

function money(value: number, purpose: string) {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  return purpose === "rent" ? `${formatted}/mês` : formatted;
}
function BedIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19v-8m18 8v-6a2 2 0 0 0-2-2H9a3 3 0 0 0-3 3v1m-3 0h18M7 11V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3" /></svg>; }
function BathIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Zm3 0V6a3 3 0 0 1 6 0v1m-8 13-1 2m15-2 1 2" /></svg>; }
function CarIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16-1-3 2-5h12l2 5-1 3H5Zm1-8 1-3h10l1 3M7 16v2m10-2v2M7.5 13h.01m8.99 0h.01" /></svg>; }
function AreaIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6M4 4v6m16-6h-6m6 0v6M4 20h6m-6 0v-6m16 6h-6m6 0v-6" /></svg>; }

export default function PublicPropertyDetail() {
  const site = useSiteSettings();
  const [property, setProperty] = useState<CatalogRow | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePhoto, setActivePhoto] = useState(0);
  const [leadMessage, setLeadMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setError("Imóvel não informado."); setLoading(false); return; }
    if (!isSupabaseConfigured || !supabaseBrowser) { setError("Catálogo online ainda não configurado."); setLoading(false); return; }
    let active = true;
    void (async () => {
      const tenant = await resolveCurrentTenant();
      const host = currentHostname();
      if (!active) return;
      if (!tenant || !host) { setError("Imobiliária não identificada para este endereço."); setLoading(false); return; }
      const [propertyResult, photoResult] = await Promise.all([
        supabaseBrowser.rpc("public_property_for_host", { p_hostname: host, p_property_id: id }),
        supabaseBrowser.rpc("public_property_photos_for_host", { p_hostname: host, p_property_id: id }),
      ]);
      if (!active) return;
      const row = Array.isArray(propertyResult.data) ? propertyResult.data[0] : null;
      if (propertyResult.error || !row || row.agency_id !== tenant.agency_id) { setError("Este imóvel não está disponível neste site."); setLoading(false); return; }
      setProperty(row as CatalogRow);
      if (Array.isArray(photoResult.data)) {
        const rows = photoResult.data as Photo[];
        const urls = (await getPropertyPhotoUrls(rows.map((photo) => photo.storage_path))).filter(Boolean);
        if (active) setImageUrls(urls);
      }
      const featureResult = await supabaseBrowser.from("property_feature_links").select("property_features(name)").eq("property_id", id);
      if (active && featureResult.data) {
        setFeatures((featureResult.data as unknown as FeatureLink[]).flatMap((featureRow) => {
          const value = featureRow.property_features;
          if (Array.isArray(value)) return value.map((item) => item.name);
          return value?.name ? [value.name] : [];
        }));
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!property) return;
    document.title = `${property.title} · ${property.code} | ${site.agency_name}`;
    const existing = document.getElementById("property-jsonld"); if (existing) existing.remove();
    const script = document.createElement("script"); script.id = "property-jsonld"; script.type = "application/ld+json";
    script.text = JSON.stringify({ "@context":"https://schema.org", "@type": property.segment === "commercial" ? "Place" : "Accommodation", name: property.title, description: property.description || undefined, address:{"@type":"PostalAddress",addressLocality:property.city,addressRegion:property.state_code}, amenityFeature:features.map((name)=>({"@type":"LocationFeatureSpecification",name,value:true})), offers:{"@type":"Offer",priceCurrency:"BRL",price:Number(property.price||0),availability:"https://schema.org/InStock"}, provider:{"@type":"RealEstateAgent",name:site.agency_name,telephone:site.phone||undefined,email:site.email||undefined} });
    document.head.appendChild(script); return () => script.remove();
  }, [property,features,site.agency_name,site.email,site.phone]);

  const whatsappUrl = useMemo(() => {
    if (!property) return "";
    const raw = property.broker_whatsapp || site.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "";
    const number = raw.replace(/\D/g, ""); if (!number) return "";
    return `https://wa.me/${number}?text=${encodeURIComponent(`Olá, gostaria de informações sobre o imóvel ${property.code}.`)}`;
  }, [property,site.whatsapp]);

  async function shareProperty() {
    if (!property) return;
    const data = { title:`${property.title} · ${property.code}`, text:`Veja este imóvel: ${property.title} (${property.code}).`, url:window.location.href };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(window.location.href); setShareMessage("Link copiado."); setTimeout(()=>setShareMessage(""),2500); } } catch { /* cancelado */ }
  }

  async function sendLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!property || !supabaseBrowser) return;
    const host=currentHostname(); if (!host) return setLeadMessage("Não foi possível identificar a imobiliária deste endereço.");
    const data=new FormData(event.currentTarget), name=String(data.get("name")||"").trim(), phone=String(data.get("phone")||"").trim(), email=String(data.get("email")||"").trim();
    const message=String(data.get("message")||"").trim()||`Interesse no imóvel ${property.code}`;
    if (!name || (!phone && !email)) return setLeadMessage("Informe seu nome e ao menos telefone ou e-mail.");
    const { error:leadError }=await supabaseBrowser.rpc("create_public_lead_for_host",{p_hostname:host,p_property_id:property.id,p_name:name,p_phone:phone||null,p_email:email||null,p_message:message,p_source:"web-property-detail"});
    setLeadMessage(leadError?"Não foi possível enviar agora. Use o WhatsApp do corretor.":"Contato enviado. O corretor poderá retornar pelo telefone ou e-mail informado."); if(!leadError) event.currentTarget.reset();
  }

  if (loading) return <main className="container propertyDetail"><div className="emptyState"><strong>Carregando imóvel...</strong></div></main>;
  if (error || !property) return <main className="container propertyDetail"><a className="backLink" href="../">← Voltar ao catálogo</a><div className="emptyState"><strong>{error||"Imóvel não encontrado."}</strong></div></main>;

  const fallbackImage="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80", currentImage=imageUrls[activePhoto]||fallbackImage;
  const area=property.built_area_m2||property.land_area_m2;
  const locationSummary=`${property.neighborhood||""}${property.neighborhood?", ":""}${property.city} - ${property.state_code}`;
  const publicAddress=property.address_public&&property.address?property.address:locationSummary;
  const previousPhoto=()=>setActivePhoto((current)=>imageUrls.length?(current-1+imageUrls.length)%imageUrls.length:0), nextPhoto=()=>setActivePhoto((current)=>imageUrls.length?(current+1)%imageUrls.length:0);
  const hasMap=Number.isFinite(Number(property.latitude))&&Number.isFinite(Number(property.longitude))&&Number(property.latitude)!==0&&Number(property.longitude)!==0;
  const lat=Number(property.latitude||0), lon=Number(property.longitude||0), delta=0.008;
  const mapUrl=hasMap?`https://www.openstreetmap.org/export/embed.html?bbox=${lon-delta}%2C${lat-delta}%2C${lon+delta}%2C${lat+delta}&layer=mapnik&marker=${lat}%2C${lon}`:"";

  return <main><PublicHeader nested /><section className="container propertyDetail modernPropertyDetail">
    <a className="backLink" href="../#imoveis">← Voltar aos imóveis</a>
    <div className="gallery dynamicGallery detailGallery"><div className="galleryMain galleryButton" style={{backgroundImage:`url(${currentImage})`}}><button className="galleryNav galleryPrev" onClick={previousPhoto} aria-label="Foto anterior">‹</button><button className="galleryNav galleryNext" onClick={nextPhoto} aria-label="Próxima foto">›</button><span className="galleryCounter">{imageUrls.length?`${activePhoto+1}/${imageUrls.length}`:"Sem fotos"}</span>{imageUrls.length>1?<button className="viewAllPhotos" onClick={()=>setActivePhoto(0)}>Ver todas as {imageUrls.length} fotos</button>:null}</div><div className="gallerySide">{imageUrls.slice(0,4).map((image,index)=><button key={image} className={`galleryThumb galleryButton ${activePhoto===index?"activeThumb":""}`} style={{backgroundImage:`url(${image})`}} onClick={()=>setActivePhoto(index)} aria-label={`Ver foto ${index+1}`} />)}</div></div>
    <button className="detailShareButton" onClick={()=>void shareProperty()}>↗ Compartilhar</button>{shareMessage?<span className="shareFeedback">{shareMessage}</span>:null}
    <div className="detailIdentity"><div className="detailBadges"><span className="detailPurposeBadge">{property.purpose==="rent"?"Locação":"Venda"}</span>{property.marketing_label?<span className="detailMarketingBadge">{property.marketing_label}</span>:null}</div><span className="propertyCode">Ref. {property.code}</span><h1>{property.title}</h1><p className="location">📍 {locationSummary}</p><strong className="detailPrice">{money(Number(property.price),property.purpose)}</strong></div>
    <div className="detailFactsIcon"><span><BedIcon /><strong>{property.bedrooms||0}</strong><small>Quartos</small></span><span><BathIcon /><strong>{property.bathrooms||0}</strong><small>Banheiros</small></span><span><CarIcon /><strong>{property.parking_spaces||0}</strong><small>Vagas</small></span><span><AreaIcon /><strong>{area?Number(area).toLocaleString("pt-BR"):"—"}</strong><small>m²</small></span></div>
    {features.length?<section className="detailSection"><h2>Características</h2><div className="featureList">{features.map((feature)=><span key={feature}>✓ {feature}</span>)}</div></section>:null}
    <section className="detailSection"><h2>Sobre o imóvel</h2><p>{property.description||"Entre em contato para receber mais informações sobre este imóvel."}</p></section>
    {hasMap?<section className="detailSection propertyMapSection"><h2>Localização</h2><div className="propertyMapFrame"><iframe title="Mapa do imóvel" src={mapUrl} loading="lazy" /></div>{property.address_public&&property.address?<div className="publicAddressCard"><strong>Endereço completo</strong><span>{publicAddress}</span></div>:<small>Localização aproximada. O endereço completo é informado pelo corretor.</small>}</section>:null}
    <div className="detailGrid"><section><div className="detailSection"><h2>Tenho interesse</h2><form className="leadForm" onSubmit={sendLead}><div className="formGrid"><label>Nome<input name="name" required maxLength={160}/></label><label>Telefone<input name="phone" maxLength={40} required/></label></div><label>E-mail<input name="email" type="email" maxLength={254}/></label><label>Mensagem<textarea name="message" rows={4} maxLength={4000} defaultValue={`Olá, tenho interesse no imóvel ${property.code}.`}/></label><button className="button primary" type="submit">Enviar contato</button>{leadMessage?<div className="formMessage">{leadMessage}</div>:null}</form></div></section><aside className="brokerCard"><span className="eyebrow">CORRETOR RESPONSÁVEL</span><h3>{property.broker_name||site.agency_name}</h3><p>{property.broker_creci||site.company_creci||"CRECI a informar"}</p>{property.broker_area_of_operation?<p>Atuação: {property.broker_area_of_operation}</p>:null}<p>Informe a referência <strong>{property.code}</strong> no atendimento.</p>{whatsappUrl?<a className="button whatsapp full" href={whatsappUrl} target="_blank" rel="noreferrer">Conversar no WhatsApp</a>:<p>WhatsApp ainda não configurado.</p>}</aside></div>
  </section></main>;
}
