"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getPropertyPhotoUrls } from "../lib/propertyPhotos";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type CatalogRow = {
  id: string; code: string; title: string; description: string | null; purpose: "sale" | "rent"; zone: "urban" | "rural";
  segment?: "residential" | "commercial"; status: string; price: number; bedrooms: number | null; suites: number | null;
  bathrooms: number | null; parking_spaces: number | null; built_area_m2: number | null; land_area_m2: number | null;
  city: string; state_code: string; neighborhood: string | null; property_type: string | null; broker_name: string | null;
  broker_whatsapp: string | null; broker_creci: string | null; broker_area_of_operation?: string | null; address: string | null; address_public: boolean;
};

type Photo = { id: string; storage_path: string; position: number; is_cover: boolean; alt_text: string | null };
type FeatureLink = { property_features: { name: string } | { name: string }[] | null };

function money(value: number, purpose: string) {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  return purpose === "rent" ? `${formatted}/mês` : formatted;
}

export default function PublicPropertyDetail() {
  const [property, setProperty] = useState<CatalogRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
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
    void Promise.all([
      supabaseBrowser.from("property_catalog").select("*").eq("id", id).maybeSingle(),
      supabaseBrowser.from("property_photos").select("id,storage_path,position,is_cover,alt_text").eq("property_id", id).order("is_cover", { ascending: false }).order("position"),
      supabaseBrowser.from("property_feature_links").select("property_features(name)").eq("property_id", id),
    ]).then(async ([propertyResult, photoResult, featureResult]) => {
      if (!active) return;
      if (propertyResult.error || !propertyResult.data) setError("Este imóvel não está disponível no catálogo.");
      else setProperty(propertyResult.data as CatalogRow);
      if (photoResult.data) {
        const rows = photoResult.data as Photo[];
        setPhotos(rows);
        const urls = (await getPropertyPhotoUrls(rows.map((photo) => photo.storage_path))).filter(Boolean);
        if (active) setImageUrls(urls);
      }
      if (featureResult.data) {
        const names = (featureResult.data as unknown as FeatureLink[]).flatMap((row) => {
          const value = row.property_features;
          if (Array.isArray(value)) return value.map((item) => item.name);
          return value?.name ? [value.name] : [];
        });
        setFeatures(names);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!property) return;
    document.title = `${property.title} · ${property.code} | IMOBILIARIAS`;
    const existing = document.getElementById("property-jsonld");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.id = "property-jsonld";
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": property.segment === "commercial" ? "Place" : "Accommodation",
      name: property.title,
      description: property.description || undefined,
      address: { "@type": "PostalAddress", addressLocality: property.city, addressRegion: property.state_code },
      amenityFeature: features.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
      offers: { "@type": "Offer", priceCurrency: "BRL", price: Number(property.price || 0), availability: "https://schema.org/InStock" },
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [property, features]);

  const whatsappUrl = useMemo(() => {
    if (!property) return "";
    const raw = property.broker_whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "";
    const number = raw.replace(/\D/g, "");
    if (!number) return "";
    const message = encodeURIComponent(`Olá, gostaria de informações sobre o imóvel código ${property.code}.`);
    return `https://wa.me/${number}?text=${message}`;
  }, [property]);

  async function shareProperty() {
    if (!property) return;
    const data = { title: `${property.title} · ${property.code}`, text: `Veja este imóvel: ${property.title} (${property.code}).`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage("Link copiado.");
        window.setTimeout(() => setShareMessage(""), 2500);
      }
    } catch { /* compartilhamento cancelado */ }
  }

  async function sendLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property || !supabaseBrowser) return;
    const data = new FormData(event.currentTarget);
    const payload = {
      property_id: property.id,
      name: String(data.get("name") || "").trim() || null,
      phone: String(data.get("phone") || "").trim() || null,
      email: String(data.get("email") || "").trim() || null,
      message: String(data.get("message") || "").trim() || `Interesse no imóvel ${property.code}`,
      source: "web-property-detail",
    };
    const { error: leadError } = await supabaseBrowser.from("leads").insert(payload);
    setLeadMessage(leadError ? "Não foi possível enviar agora. Use o WhatsApp do corretor." : "Contato enviado. O corretor poderá retornar pelo telefone ou e-mail informado.");
    if (!leadError) event.currentTarget.reset();
  }

  if (loading) return <main className="container propertyDetail"><div className="emptyState"><strong>Carregando imóvel...</strong></div></main>;
  if (error || !property) return <main className="container propertyDetail"><a className="backLink" href="../">← Voltar ao catálogo</a><div className="emptyState"><strong>{error || "Imóvel não encontrado."}</strong></div></main>;

  const fallbackImage = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80";
  const currentImage = imageUrls[activePhoto] || fallbackImage;
  const area = property.built_area_m2 || property.land_area_m2;
  const publicAddress = property.address_public && property.address ? property.address : `${property.neighborhood || ""}, ${property.city} - ${property.state_code}`;
  const previousPhoto = () => setActivePhoto((current) => imageUrls.length ? (current - 1 + imageUrls.length) % imageUrls.length : 0);
  const nextPhoto = () => setActivePhoto((current) => imageUrls.length ? (current + 1) % imageUrls.length : 0);

  return (
    <main>
      <header className="topbar"><div className="container nav"><a className="brand" href="../"><span className="brandMark">I</span><span>IMOBILIARIAS</span></a><nav className="navLinks"><a href="../#imoveis">Imóveis</a><a href="../#como-funciona">Como funciona</a><a href="../#contato">Contato</a></nav>{whatsappUrl ? <a className="button primary small" href={whatsappUrl} target="_blank" rel="noreferrer">Falar com corretor</a> : null}</div></header>
      <section className="container propertyDetail">
        <div className="detailTopActions"><a className="backLink" href="../#imoveis">← Voltar aos imóveis</a><button className="miniShare" onClick={() => void shareProperty()}>Compartilhar</button>{shareMessage ? <span>{shareMessage}</span> : null}</div>
        <div className="detailHeader"><div><span className="eyebrow">{property.code} · {property.purpose === "rent" ? "LOCAÇÃO" : "VENDA"}</span><h1>{property.title}</h1><p className="location">📍 {publicAddress}</p></div><strong className="detailPrice">{money(Number(property.price), property.purpose)}</strong></div>
        <div className="gallery dynamicGallery"><div className="galleryMain galleryButton" style={{ backgroundImage: `url(${currentImage})` }} aria-label="Foto principal"><button className="galleryNav galleryPrev" onClick={previousPhoto} aria-label="Foto anterior">‹</button><button className="galleryNav galleryNext" onClick={nextPhoto} aria-label="Próxima foto">›</button><span className="galleryCounter">{imageUrls.length ? `${activePhoto + 1}/${imageUrls.length}` : "Sem fotos"}</span></div><div className="gallerySide">{imageUrls.slice(0, 4).map((image, index) => <button key={image} className={`galleryThumb galleryButton ${activePhoto === index ? "activeThumb" : ""}`} style={{ backgroundImage: `url(${image})` }} onClick={() => setActivePhoto(index)} aria-label={`Ver foto ${index + 1}`} />)}</div></div>
        {imageUrls.length > 4 ? <div className="galleryPager">{imageUrls.map((_, index) => <button key={index} className={activePhoto === index ? "active" : ""} onClick={() => setActivePhoto(index)} aria-label={`Foto ${index + 1}`}>{index + 1}</button>)}</div> : null}
        <div className="detailGrid"><section><div className="facts"><span><strong>{property.bedrooms || 0}</strong> quartos</span><span><strong>{property.suites || 0}</strong> suítes</span><span><strong>{property.bathrooms || 0}</strong> banheiros</span><span><strong>{property.parking_spaces || 0}</strong> vagas</span></div><div className="facts secondaryFacts"><span><strong>{area ? Number(area).toLocaleString("pt-BR") : "—"}</strong> m²</span><span><strong>{property.property_type || "Imóvel"}</strong> tipo</span><span><strong>{property.segment === "commercial" ? "Comercial" : "Residencial"}</strong> uso</span><span><strong>{property.zone === "rural" ? "Rural" : "Urbana"}</strong> zona</span></div>{features.length > 0 ? <div className="detailSection"><h2>Características</h2><div className="featureList">{features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></div> : null}<div className="detailSection"><h2>Sobre o imóvel</h2><p>{property.description || "Entre em contato para receber mais informações sobre este imóvel."}</p></div><div className="detailSection"><h2>Tenho interesse</h2><form className="leadForm" onSubmit={sendLead}><div className="formGrid"><label>Nome<input name="name" required /></label><label>Telefone<input name="phone" required /></label></div><label>E-mail<input name="email" type="email" /></label><label>Mensagem<textarea name="message" rows={4} defaultValue={`Olá, tenho interesse no imóvel ${property.code}.`} /></label><button className="button primary" type="submit">Enviar contato</button>{leadMessage ? <div className="formMessage">{leadMessage}</div> : null}</form></div></section><aside className="brokerCard"><span className="eyebrow">CORRETOR RESPONSÁVEL</span><h3>{property.broker_name || "Atendimento da imobiliária"}</h3><p>{property.broker_creci || "CRECI a informar"}</p>{property.broker_area_of_operation ? <p>Atuação: {property.broker_area_of_operation}</p> : null}<p>O código <strong>{property.code}</strong> já identifica este imóvel no atendimento.</p>{whatsappUrl ? <a className="button whatsapp full" href={whatsappUrl} target="_blank" rel="noreferrer">Conversar no WhatsApp</a> : <p>WhatsApp ainda não configurado para este imóvel.</p>}</aside></div>
      </section>
    </main>
  );
}
