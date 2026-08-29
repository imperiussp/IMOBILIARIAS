"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getPropertyPhotoUrls } from "../lib/propertyPhotos";
import { currentHostname, resolveCurrentTenant } from "../lib/tenantResolver";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type FeaturedProperty = {
  id: string;
  code: string;
  title: string;
  city: string;
  state: string;
  neighborhood: string;
  propertyType: string;
  purpose: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  area: number;
  image: string;
  label: string;
};

function money(value: number, purpose: string) {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
  return purpose === "rent" ? `${formatted}/mês` : formatted;
}

export default function PublicFeaturedPropertiesMount() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [rows, setRows] = useState<FeaturedProperty[]>([]);

  useEffect(() => {
    if (window.location.pathname.includes("/admin") || window.location.pathname.includes("/app")) return;
    let active = true;
    let observer: MutationObserver | null = null;

    const attach = () => {
      const target = document.getElementById("lancamentos") || document.getElementById("imoveis");
      if (!target?.parentElement) return false;
      let node = document.getElementById("tenant-featured-portal");
      if (!node) {
        node = document.createElement("div");
        node.id = "tenant-featured-portal";
        target.parentElement.insertBefore(node, target);
      }
      setHost(node);
      return true;
    };

    if (!attach()) {
      observer = new MutationObserver(() => { if (attach()) observer?.disconnect(); });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    void (async () => {
      if (!supabaseBrowser) return;
      const tenant = await resolveCurrentTenant();
      const hostName = currentHostname();
      if (!tenant || !hostName || !active) return;
      const { data, error } = await supabaseBrowser.rpc("public_catalog_for_host", { p_hostname: hostName });
      if (error || !Array.isArray(data) || !active) return;

      const normalizedHost = hostName.toLowerCase().split(":")[0];
      const isTestCatalog = normalizedHost === "teste.imoveis.lenoy.com.br" || normalizedHost.startsWith("teste.");
      const selected = isTestCatalog
        ? [...data].sort((a: any, b: any) => String(a.code || "").localeCompare(String(b.code || ""), "pt-BR")).slice(0, 9)
        : data.filter((item: any) => item.featured === true).slice(0, 6);

      const paths = selected.map((item: any) => item.cover_thumbnail_path || item.cover_path || null);
      const photos = await getPropertyPhotoUrls(paths);
      if (!active) return;
      setRows(selected.map((item: any, index: number) => ({
        id: String(item.id),
        code: String(item.code || ""),
        title: String(item.title || "Imóvel em destaque"),
        city: String(item.city || ""),
        state: String(item.state_code || ""),
        neighborhood: String(item.neighborhood || "Localização não informada"),
        propertyType: String(item.property_type || "Imóvel"),
        purpose: String(item.purpose || "sale"),
        price: Number(item.price || 0),
        bedrooms: Number(item.bedrooms || 0),
        bathrooms: Number(item.bathrooms || 0),
        parking: Number(item.parking_spaces || 0),
        area: Number(item.built_area_m2 || item.land_area_m2 || 0),
        image: photos[index] || "",
        label: String(item.marketing_label || "Destaque"),
      })));
    })();

    return () => { active = false; observer?.disconnect(); };
  }, []);

  if (!host || !rows.length) return null;

  return createPortal(
    <section className="container section publicFeaturedSection" id="destaques">
      <div className="sectionHeading resultsHeading">
        <div><span className="eyebrow">SELEÇÃO DA IMOBILIÁRIA</span><h2>Destaques</h2><p className="sectionIntro">Imóveis escolhidos pela equipe para ganhar maior visibilidade.</p></div>
        <a className="button secondary" href="#imoveis">Ver catálogo</a>
      </div>
      <div className="propertyGrid publicFeaturedGrid">
        {rows.map((property) => <article className="propertyCard modernPropertyCard featuredPropertyCard" key={property.id}>
          <div className="propertyImage" style={property.image ? { backgroundImage: `url(${property.image})` } : undefined}>
            <a className="imageLink" href={`imovel/?id=${encodeURIComponent(property.id)}`} aria-label={`Abrir ${property.title}`} />
            <div className="propertyBadges"><span className="badge featuredBadge">Destaque</span>{property.label && property.label.toLocaleLowerCase("pt-BR") !== "destaque" ? <span className="badge marketingBadge">{property.label}</span> : null}</div>
          </div>
          <div className="propertyBody">
            <span className="propertyCode">Ref. {property.code} · {property.propertyType}</span>
            <h3><a href={`imovel/?id=${encodeURIComponent(property.id)}`}>{property.title}</a></h3>
            <p className="location">📍 {property.neighborhood}{property.city ? `, ${property.city}` : ""}{property.state ? ` - ${property.state}` : ""}</p>
            <div className="propertyFactsCompact featuredFacts"><span>🛏 {property.bedrooms}</span><span>🚿 {property.bathrooms}</span><span>🚗 {property.parking}</span><span>▣ {property.area ? `${property.area.toLocaleString("pt-BR")} m²` : "Consultar"}</span></div>
            <div className="propertyFooter"><strong>{money(property.price, property.purpose)}</strong><a href={`imovel/?id=${encodeURIComponent(property.id)}`}>Ver detalhes →</a></div>
          </div>
        </article>)}
      </div>
    </section>,
    host,
  );
}
