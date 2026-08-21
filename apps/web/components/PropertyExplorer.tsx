"use client";

import { useEffect, useMemo, useState } from "react";
import type { Property } from "../lib/properties";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Props = { properties: Property[] };

type DisplayProperty = {
  id?: string;
  code: string;
  slug: string;
  title: string;
  city: string;
  neighborhood: string;
  purpose: "Venda" | "Locação";
  category: string;
  segment: "Residencial" | "Comercial";
  zone: "Urbana" | "Rural";
  price: string;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  area: string;
  image: string;
  detailHref: string;
};

const fallbackImage = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80";

function money(value: number, purpose: string) {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
  return purpose === "rent" ? `${formatted}/mês` : formatted;
}

function demoToDisplay(property: Property): DisplayProperty {
  return {
    code: property.code,
    slug: property.slug,
    title: property.title,
    city: property.city,
    neighborhood: property.neighborhood,
    purpose: property.purpose,
    category: property.category,
    segment: property.category === "Comercial" ? "Comercial" : "Residencial",
    zone: property.category === "Rural" ? "Rural" : "Urbana",
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parking,
    area: property.area,
    image: property.images[0] || fallbackImage,
    detailHref: `imovel/${property.slug}/`,
  };
}

export default function PropertyExplorer({ properties }: Props) {
  const [catalog, setCatalog] = useState<DisplayProperty[]>(properties.map(demoToDisplay));
  const [source, setSource] = useState<"demo" | "supabase">("demo");
  const [purpose, setPurpose] = useState<"Venda" | "Locação">("Venda");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [segment, setSegment] = useState("");
  const [zone, setZone] = useState("");
  const [bedrooms, setBedrooms] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem("imobiliarias:favorites");
    if (stored) {
      try { setFavorites(JSON.parse(stored)); } catch { setFavorites([]); }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseBrowser) return;
    let active = true;
    void supabaseBrowser
      .from("property_catalog")
      .select("id,code,slug,title,purpose,zone,segment,status,price,bedrooms,bathrooms,parking_spaces,built_area_m2,land_area_m2,city,state_code,neighborhood,property_type,cover_path,featured,published_at")
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active || error || !data || data.length === 0) return;
        const mapped: DisplayProperty[] = data.map((item: any) => {
          const image = item.cover_path && process.env.NEXT_PUBLIC_SUPABASE_URL
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/property-photos/${item.cover_path}`
            : fallbackImage;
          const areaValue = item.built_area_m2 || item.land_area_m2;
          return {
            id: item.id,
            code: item.code,
            slug: item.slug,
            title: item.title,
            city: `${item.city}${item.state_code ? ` - ${item.state_code}` : ""}`,
            neighborhood: item.neighborhood || "Localização não informada",
            purpose: item.purpose === "rent" ? "Locação" : "Venda",
            category: item.property_type || "Imóvel",
            segment: item.segment === "commercial" ? "Comercial" : "Residencial",
            zone: item.zone === "rural" ? "Rural" : "Urbana",
            price: money(Number(item.price || 0), item.purpose),
            bedrooms: Number(item.bedrooms || 0),
            bathrooms: Number(item.bathrooms || 0),
            parking: Number(item.parking_spaces || 0),
            area: areaValue ? `${Number(areaValue).toLocaleString("pt-BR")} m²` : "Área a consultar",
            image,
            detailHref: `imovel/?id=${encodeURIComponent(item.id)}`,
          };
        });
        setCatalog(mapped);
        setSource("supabase");
      });
    return () => { active = false; };
  }, []);

  function toggleFavorite(code: string) {
    setFavorites((current) => {
      const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
      window.localStorage.setItem("imobiliarias:favorites", JSON.stringify(next));
      return next;
    });
  }

  function clearFilters() {
    setCity(""); setCategory(""); setSegment(""); setZone(""); setBedrooms(0);
  }

  const filtered = useMemo(() => catalog.filter((property) => {
    const samePurpose = property.purpose === purpose;
    const term = city.toLowerCase();
    const sameCity = !city || property.city.toLowerCase().includes(term) || property.neighborhood.toLowerCase().includes(term);
    const sameCategory = !category || property.category === category;
    const sameSegment = !segment || property.segment === segment;
    const sameZone = !zone || property.zone === zone;
    const enoughBedrooms = !bedrooms || property.bedrooms >= bedrooms;
    return samePurpose && sameCity && sameCategory && sameSegment && sameZone && enoughBedrooms;
  }), [catalog, purpose, city, category, segment, zone, bedrooms]);

  const categories = useMemo(() => Array.from(new Set(catalog.map((item) => item.category))).filter(Boolean).sort(), [catalog]);

  return (
    <>
      <section className="hero" id="inicio">
        <div className="container heroGrid">
          <div>
            <span className="eyebrow">SEU PRÓXIMO IMÓVEL COMEÇA AQUI</span>
            <h1>Encontre um lugar para chamar de seu.</h1>
            <p>Venda, locação, imóveis urbanos, rurais, residenciais e comerciais em uma busca simples e direta.</p>
            <div className="heroStats"><span><strong>{catalog.length}</strong> imóveis {source === "supabase" ? "no catálogo" : "demonstrativos"}</span><span><strong>{favorites.length}</strong> favoritos</span></div>
          </div>
          <div className="searchBox">
            <div className="searchTabs">
              <button className={purpose === "Venda" ? "active" : ""} onClick={() => setPurpose("Venda")}>Comprar</button>
              <button className={purpose === "Locação" ? "active" : ""} onClick={() => setPurpose("Locação")}>Alugar</button>
            </div>
            <label>Cidade ou bairro<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex.: Sengés" /></label>
            <div className="searchRow">
              <label>Tipo<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todos</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Quartos<select value={bedrooms} onChange={(event) => setBedrooms(Number(event.target.value))}><option value="0">Qualquer</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select></label>
            </div>
            <div className="searchRow">
              <label>Uso<select value={segment} onChange={(event) => setSegment(event.target.value)}><option value="">Residencial ou comercial</option><option>Residencial</option><option>Comercial</option></select></label>
              <label>Zona<select value={zone} onChange={(event) => setZone(event.target.value)}><option value="">Urbana ou rural</option><option>Urbana</option><option>Rural</option></select></label>
            </div>
            <div className="filterActions"><a className="button primary full" href="#imoveis">Ver resultados</a><button className="clearButton" onClick={clearFilters}>Limpar filtros</button></div>
          </div>
        </div>
      </section>

      <section className="container quickFilters">
        {["Casa", "Apartamento", "Rural", "Comercial"].map((item) => (
          <button key={item} className={`quickFilterButton ${category === item ? "selected" : ""}`} onClick={() => setCategory(category === item ? "" : item)}>{item === "Casa" ? "🏠" : item === "Apartamento" ? "🏢" : item === "Rural" ? "🌿" : "🏪"} {item}</button>
        ))}
      </section>

      <section className="container section" id="imoveis">
        <div className="sectionHeading"><div><span className="eyebrow">RESULTADOS</span><h2>Imóveis encontrados</h2></div><span className="resultCount">{filtered.length} {filtered.length === 1 ? "imóvel" : "imóveis"}</span></div>
        {filtered.length > 0 ? (
          <div className="propertyGrid">
            {filtered.map((property) => (
              <article className="propertyCard" key={property.code}>
                <div className="propertyImage" style={{ backgroundImage: `url(${property.image})` }}>
                  <a className="imageLink" href={property.detailHref} aria-label={`Abrir ${property.title}`} />
                  <span className="badge">{property.purpose}</span>
                  <button className={`favorite ${favorites.includes(property.code) ? "isFavorite" : ""}`} aria-label="Favoritar" onClick={() => toggleFavorite(property.code)}>{favorites.includes(property.code) ? "♥" : "♡"}</button>
                </div>
                <div className="propertyBody">
                  <span className="propertyCode">{property.code} · {property.category} · {property.zone}</span>
                  <h3><a href={property.detailHref}>{property.title}</a></h3>
                  <p className="location">📍 {property.neighborhood}, {property.city}</p>
                  <p className="meta">{property.bedrooms} quartos • {property.bathrooms} banheiros • {property.parking} vagas • {property.area}</p>
                  <div className="propertyFooter"><strong>{property.price}</strong><a href={property.detailHref}>Ver detalhes →</a></div>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="emptyState"><strong>Nenhum imóvel encontrado.</strong><p>Tente limpar os filtros ou escolher outra finalidade.</p><button className="button primary" onClick={clearFilters}>Limpar filtros</button></div>}
      </section>
    </>
  );
}
